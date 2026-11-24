#!/usr/bin/env python3
"""Put the online project into an HTML5 export, at build time.

The game reads its online settings from `window.ICE_WOLF_ONLINE_CONFIG` — the
first place `readConfig()` looks, ahead of `localStorage` and the GDevelop scene
variables `OnlineConfigUrl` / `OnlineConfigKey` (see `docs/v110-online-setup.md`
§3). Keeping the values out of `game.json` keeps the GDevelop project free of
configuration, and `tests/pro/v110-online.test.mjs` fails if a project URL or a
key is ever written into the game file. This script writes the one-line snippet
into the exported `index.html` instead, so a TestFlight build has online rooms
from the first launch with nothing for the player to set up.

    python3 scripts/ios/inject-online-config.py \
      --file ios/App/App/public/index.html

Defaults are the production `games-realtime` project. Both may be overridden
with `--url` / `--key` or with `ICEWOLF_SUPABASE_URL` / `ICEWOLF_SUPABASE_ANON_KEY`
(a staging project, for example).

About the key: `sb_publishable_...` is the publishable API key. It is meant to
ship inside client apps — it names the project and grants what the publishable
role grants, which for this game is joining a Broadcast/Presence channel. It is
not a secret, and it is recoverable from any installed app anyway. The
`service_role` / `sb_secret_...` key never belongs here and this script refuses
it.

The snippet is idempotent: the block is delimited by markers and replaced in
place, so running the build twice does not stack copies.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FILE = REPO_ROOT / "ios" / "App" / "App" / "public" / "index.html"

DEFAULT_URL = "https://siivncidktbuyqwsjeqd.supabase.co"
DEFAULT_KEY = "sb_publishable_lrs0ilfAGmibFiiP4DHYaA_Bk7lgzuZ"

BEGIN = "<!-- ICE WOLF online config:begin (scripts/ios/inject-online-config.py) -->"
END = "<!-- ICE WOLF online config:end -->"

URL_PATTERN = re.compile(r"^https://[a-z0-9][a-z0-9-]*\.supabase\.co$")


def fail(message: str) -> None:
    print(f"  STOP  {message}", file=sys.stderr)
    raise SystemExit(1)


def mask(key: str) -> str:
    return f"{key[:18]}…{key[-4:]}" if len(key) > 26 else f"{key[:4]}…"


def snippet(url: str, key: str) -> str:
    return (
        f"{BEGIN}\n"
        "<script>\n"
        "  /* Set by scripts/ios/inject-online-config.py at build time.\n"
        "   * Read by game.json readConfig() before localStorage and the scene variables. */\n"
        f"  window.ICE_WOLF_ONLINE_CONFIG = {{ url: '{url}', key: '{key}' }};\n"
        "</script>\n"
        f"{END}"
    )


def strip_existing(html: str) -> str:
    """Remove an earlier block (and its surrounding blank line) if present."""
    pattern = re.compile(
        r"\n?[ \t]*" + re.escape(BEGIN) + r".*?" + re.escape(END) + r"[ \t]*\n?",
        re.DOTALL,
    )
    return pattern.sub("\n", html, count=1)


def inject(path: Path, url: str, key: str) -> str:
    if not path.is_file():
        fail(f"{path} does not exist (is this the exported build/ or ios/App/App/public/?)")

    html = path.read_text(encoding="utf-8")
    if "ICE WOLF online config" in html and BEGIN not in html:
        fail(
            f"{path} already carries a window.ICE_WOLF_ONLINE_CONFIG that this script "
            "did not write; remove it by hand so the build stays one source of truth"
        )

    html = strip_existing(html)
    block = snippet(url, key)

    anchor = html.lower().rfind("</head>")
    if anchor >= 0:
        updated = html[:anchor] + block + "\n" + html[anchor:]
    elif "<body" in html.lower():
        body = html.lower().rfind("<body")
        updated = html[:body] + block + "\n" + html[body:]
    else:
        updated = html + "\n" + block + "\n"

    path.write_text(updated, encoding="utf-8")
    return f"{path} ({len(html)} -> {len(updated)} bytes)"


def verify(path: Path, url: str, key: str) -> list[str]:
    problems: list[str] = []
    if not path.is_file():
        return [f"{path} does not exist"]
    html = path.read_text(encoding="utf-8")
    if html.count(BEGIN) != 1 or html.count(END) != 1:
        problems.append(f"{path} does not carry exactly one online config block")
    if url not in html:
        problems.append(f"{path} does not name {url}")
    if key not in html:
        problems.append(f"{path} does not carry the publishable key")
    head = html.lower().rfind("</head>")
    if head >= 0 and html.find(BEGIN) > head:
        problems.append(f"{path} sets the config after </head>, too late for the game")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--file", action="append", default=None,
                        help="index.html to write (repeatable). Default: ios/App/App/public/index.html")
    parser.add_argument("--url", default=os.environ.get("ICEWOLF_SUPABASE_URL", DEFAULT_URL))
    parser.add_argument("--key", default=os.environ.get("ICEWOLF_SUPABASE_ANON_KEY", DEFAULT_KEY))
    parser.add_argument("--check", action="store_true",
                        help="verify only: write nothing, exit 1 if a file is not configured")
    args = parser.parse_args()

    url = args.url.strip().rstrip("/")
    key = args.key.strip()

    print(f"ICE WOLF online config -> {url}")
    if not URL_PATTERN.match(url):
        fail(f"--url must look like https://<project>.supabase.co, got {url!r}")
    if key.startswith("sb_secret_") or "service_role" in key:
        fail("that is a secret key: only the publishable (sb_publishable_...) or legacy anon key may ship")
    if len(key) < 20:
        fail(f"the key is too short to be an anon/publishable key ({len(key)} characters)")
    print(f"  key {mask(key)} ({len(key)} characters, publishable)")

    files = [Path(item) for item in (args.file or [str(DEFAULT_FILE)])]
    if args.check:
        problems: list[str] = []
        for path in files:
            problems.extend(verify(path, url, key))
        for problem in problems:
            print(f"  FAIL  {problem}")
        if problems:
            return 1
        print(f"  PASS  {len(files)} file(s) carry the online config before </head>")
        return 0

    for path in files:
        print(f"  wrote {inject(path, url, key)}")
    problems = []
    for path in files:
        problems.extend(verify(path, url, key))
    if problems:
        for problem in problems:
            print(f"  FAIL  {problem}")
        return 1
    print(f"  PASS  {len(files)} file(s) carry the online config before </head>")
    return 0


if __name__ == "__main__":
    sys.exit(main())
