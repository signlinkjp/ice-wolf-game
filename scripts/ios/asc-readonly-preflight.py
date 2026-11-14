#!/usr/bin/env python3
"""Read-only App Store Connect gate before a TestFlight upload.

Adapted from signlinkjp/eleven-game-fresh Scripts/fresh-build2-asc-readonly-preflight.py
so ICE WOLF ships under the same conventions.

It makes GET requests only — it never creates or changes Apple data — and it stops
the upload (HOLD) when:

  * the App Store Connect app record for the bundle id does not exist yet
    (Apple requires it, and it can only be created by hand in the web UI)
  * a build with this number already exists for the app (Apple would reject it)

Environment (all required):
  APPLE_KEY_ID      App Store Connect API key id
  APPLE_ISSUER_ID   App Store Connect issuer id
  APPLE_P8_PATH     path to the .p8 private key

Exit 0 = clear to upload, any other code = stop.
"""

from __future__ import annotations

import argparse
import base64
import datetime
import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.parse
import urllib.request

API_ORIGIN = "https://api.appstoreconnect.apple.com"
MAX_PAGES = 20


def hold(reason: str) -> None:
    raise SystemExit("HOLD: " + reason)


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def unpack_der_ecdsa(der: bytes) -> bytes:
    """Convert an OpenSSL ASN.1 ECDSA signature to the JWT R || S form."""
    if len(der) < 8 or der[0] != 0x30:
        hold("APPLE_JWT_ASN1_NOT_SEQUENCE")

    def read_len(offset: int) -> tuple[int, int]:
        first = der[offset]
        if first < 128:
            return first, offset + 1
        count = first & 127
        if not 1 <= count <= 2:
            hold("APPLE_JWT_ASN1_LENGTH")
        return int.from_bytes(der[offset + 1 : offset + 1 + count], "big"), offset + 1 + count

    size, pos = read_len(1)
    if pos + size != len(der):
        hold("APPLE_JWT_ASN1_SEQUENCE_SIZE")
    values = []
    for _ in range(2):
        if pos >= len(der) or der[pos] != 0x02:
            hold("APPLE_JWT_ASN1_INTEGER")
        size, pos = read_len(pos + 1)
        raw = der[pos : pos + size]
        if not raw:
            hold("APPLE_JWT_EMPTY_INTEGER")
        values.append(int.from_bytes(raw, "big"))
        pos += size
    if pos != len(der) or any(not 0 < v < 2**256 for v in values):
        hold("APPLE_JWT_SIGNATURE_INVALID")
    return values[0].to_bytes(32, "big") + values[1].to_bytes(32, "big")


def make_token() -> str:
    kid = os.environ.get("APPLE_KEY_ID", "")
    issuer = os.environ.get("APPLE_ISSUER_ID", "")
    keyfile = pathlib.Path(os.environ.get("APPLE_P8_PATH", ""))
    if not kid or not issuer:
        hold("APPLE_KEY_ID_OR_ISSUER_MISSING")
    if not keyfile.is_file():
        hold("APPLE_KEY_FILE_NOT_FOUND")
    header = {"alg": "ES256", "kid": kid, "typ": "JWT"}
    now = int(time.time())
    payload = {"iss": issuer, "iat": now, "exp": now + 300, "aud": "appstoreconnect-v1"}
    unsigned = ".".join(
        [
            b64url(json.dumps(header, separators=(",", ":")).encode()),
            b64url(json.dumps(payload, separators=(",", ":")).encode()),
        ]
    )
    signed = subprocess.run(
        ["openssl", "dgst", "-sha256", "-sign", str(keyfile)],
        input=unsigned.encode("ascii"),
        capture_output=True,
        check=False,
    )
    if signed.returncode:
        hold("APPLE_JWT_SIGNATURE_FAILED")
    return unsigned + "." + b64url(unpack_der_ecdsa(signed.stdout))


def get_json(path: str, token: str) -> dict:
    url = urllib.parse.urljoin(API_ORIGIN, path)
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.netloc != "api.appstoreconnect.apple.com":
        hold("APPLE_API_HOST_MISMATCH")
    request = urllib.request.Request(
        url,
        headers={"Authorization": "Bearer " + token, "Accept": "application/json"},
        method="GET",
    )

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None

    # Never forward the Apple bearer token to an HTTP redirect destination.
    opener = urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(request, timeout=25) as response:
            raw = response.read(4_000_001)
    except Exception as error:  # noqa: BLE001 - any failure must stop the upload
        hold(f"APPLE_READ_ONLY_API_FAILED ({error})")
    if len(raw) > 4_000_000:
        hold("APPLE_RESPONSE_TOO_LARGE")
    try:
        document = json.loads(raw)
    except (TypeError, ValueError):
        hold("APPLE_RESPONSE_NOT_JSON")
    if not isinstance(document, dict) or not isinstance(document.get("data"), list):
        hold("APPLE_RESPONSE_INVALID")
    return document


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build", required=True, help="CFBundleVersion that is about to be uploaded")
    parser.add_argument("--bundle-id", default="jp.signlink.IceWolf")
    args = parser.parse_args()

    expected_build = str(args.build)
    expected_bundle = args.bundle_id

    token = make_token()
    query = urllib.parse.urlencode({"filter[bundleId]": expected_bundle, "limit": "20"})
    apps = get_json("/v1/apps?" + query, token)["data"]
    matches = [
        item
        for item in apps
        if isinstance(item, dict) and item.get("attributes", {}).get("bundleId") == expected_bundle
    ]
    if not matches:
        hold(
            f"ICEWOLF_ASC_APP_NOT_FOUND — create the app record in App Store Connect first "
            f"(My Apps > + > New App, bundle id {expected_bundle}). Nothing was uploaded."
        )
    if len(matches) != 1:
        hold(f"ICEWOLF_ASC_APP_NOT_UNIQUE — {len(matches)} app records use {expected_bundle}")
    app_id = str(matches[0].get("id", ""))
    if not app_id.isdigit():
        hold("ICEWOLF_ASC_APP_ID_INVALID")
    app_name = matches[0].get("attributes", {}).get("name", "?")

    path = f"/v1/apps/{app_id}/builds?limit=200"
    seen_urls: set[str] = set()
    for _ in range(MAX_PAGES):
        if path in seen_urls:
            hold("APPLE_BUILD_PAGINATION_CYCLE")
        seen_urls.add(path)
        document = get_json(path, token)
        for item in document["data"]:
            attributes = item.get("attributes", {}) if isinstance(item, dict) else {}
            if str(attributes.get("version", "")) == expected_build:
                hold(
                    f"ICEWOLF_BUILD_ALREADY_PRESENT — build {expected_build} already exists on "
                    f"{app_name} (app {app_id}); pick a higher --build-number"
                )
        next_url = (document.get("links") or {}).get("next")
        if not next_url:
            print(
                f"PASS: App Store Connect app {app_name} (id {app_id}) exists for {expected_bundle} "
                f"and build {expected_build} has not been used"
            )
            return
        parsed = urllib.parse.urlparse(next_url)
        if parsed.scheme != "https" or parsed.netloc != "api.appstoreconnect.apple.com":
            hold("APPLE_NEXT_PAGE_HOST")
        path = next_url
    hold("APPLE_BUILD_PAGINATION_LIMIT")


if __name__ == "__main__":
    main()
