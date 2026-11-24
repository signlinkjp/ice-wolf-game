#!/usr/bin/env python3
"""Static verification of the ICE WOLF iOS shell.

Runs anywhere Python 3 is available (no Xcode needed), so the same checks can be
run locally, in the GitHub Actions export job and in the macOS build job.

Checked here:
  * Info.plist is landscape-only, full screen, status bar hidden
  * the Xcode project carries the ICE WOLF bundle id, versions and team
  * the app icon is a 1024x1024 RGB PNG with no alpha (App Store requirement)
  * every asset the asset catalog references actually exists
  * capacitor.config.ts still points at appId / appName / webDir `build`
  * with --require-online-config: the web layer carries the Supabase project in
    window.ICE_WOLF_ONLINE_CONFIG before </head> (what makes a build online)

Exit code 0 = all checks pass, 1 = at least one check failed.
"""

from __future__ import annotations

import argparse
import json
import plistlib
import re
import struct
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
IOS_APP = REPO_ROOT / "ios" / "App" / "App"
INFO_PLIST = IOS_APP / "Info.plist"
PBXPROJ = REPO_ROOT / "ios" / "App" / "App.xcodeproj" / "project.pbxproj"
CAP_CONFIG = REPO_ROOT / "capacitor.config.ts"

DEFAULT_BUNDLE_ID = "jp.signlink.IceWolf"
DEFAULT_TEAM_ID = "TGBNH8WJV6"
DEFAULT_MARKETING_VERSION = "1.2.0"
DEFAULT_BUILD_NUMBER = "32"
PRODUCT_ID = "jp.signlink.IceWolf.pro"

failures: list[str] = []
notes: list[str] = []


def ok(message: str) -> None:
    print(f"  PASS  {message}")


def fail(message: str) -> None:
    failures.append(message)
    print(f"  FAIL  {message}")


def check(condition: bool, message: str, detail: str = "") -> None:
    if condition:
        ok(message)
    else:
        fail(message + (f" ({detail})" if detail else ""))


def png_size_and_alpha(path: Path) -> tuple[tuple[int, int], bool]:
    """Return ((width, height), has_alpha) by reading the IHDR chunk."""
    with path.open("rb") as handle:
        signature = handle.read(8)
        if signature != b"\x89PNG\r\n\x1a\n":
            raise ValueError("not a PNG file")
        length = struct.unpack(">I", handle.read(4))[0]
        chunk_type = handle.read(4)
        if chunk_type != b"IHDR" or length < 13:
            raise ValueError("missing IHDR chunk")
        width, height, bit_depth, color_type = struct.unpack(">IIBB", handle.read(10))
    # color types 4 (grey+alpha) and 6 (RGB+alpha) carry transparency
    return (width, height), color_type in (4, 6)


def check_info_plist() -> None:
    print("Info.plist")
    if not INFO_PLIST.is_file():
        fail(f"{INFO_PLIST} is missing")
        return
    with INFO_PLIST.open("rb") as handle:
        info = plistlib.load(handle)

    expected_landscape = [
        "UIInterfaceOrientationLandscapeLeft",
        "UIInterfaceOrientationLandscapeRight",
    ]
    check(
        info.get("UISupportedInterfaceOrientations") == expected_landscape,
        "iPhone orientations are landscape left/right only",
        str(info.get("UISupportedInterfaceOrientations")),
    )
    check(
        info.get("UISupportedInterfaceOrientations~ipad") == expected_landscape,
        "iPad orientations are landscape left/right only",
        str(info.get("UISupportedInterfaceOrientations~ipad")),
    )
    check(info.get("UIRequiresFullScreen") is True, "UIRequiresFullScreen is true")
    check(info.get("UIStatusBarHidden") is True, "UIStatusBarHidden is true")
    check(
        info.get("UIViewControllerBasedStatusBarAppearance") is False,
        "UIViewControllerBasedStatusBarAppearance is false",
    )
    check(
        info.get("CFBundleDisplayName") == "ICE WOLF",
        "CFBundleDisplayName is ICE WOLF",
        str(info.get("CFBundleDisplayName")),
    )
    check(
        info.get("CFBundleIdentifier") == "$(PRODUCT_BUNDLE_IDENTIFIER)",
        "CFBundleIdentifier is driven by the build setting",
    )
    check(
        info.get("ITSAppUsesNonExemptEncryption") is False,
        "ITSAppUsesNonExemptEncryption is false (no export-compliance prompt)",
    )
    manifest = info.get("UIApplicationSceneManifest") or {}
    check(
        "UIWindowSceneSessionRoleApplication" in (manifest.get("UISceneConfigurations") or {}),
        "scene manifest is present",
    )
    capabilities = info.get("UIRequiredDeviceCapabilities") or []
    check(
        capabilities == ["arm64"],
        "UIRequiredDeviceCapabilities is arm64 only",
        str(capabilities),
    )


def pbxproj_settings(text: str, key: str) -> list[str]:
    return re.findall(rf"{key} = ([^;]+);", text)


def check_pbxproj(bundle_id: str, team_id: str, marketing: str, build: str) -> None:
    print("Xcode project")
    if not PBXPROJ.is_file():
        fail(f"{PBXPROJ} is missing")
        return
    text = PBXPROJ.read_text(encoding="utf-8")

    bundle_ids = pbxproj_settings(text, "PRODUCT_BUNDLE_IDENTIFIER")
    check(
        len(bundle_ids) == 2 and all(v.strip('"') == bundle_id for v in bundle_ids),
        f"PRODUCT_BUNDLE_IDENTIFIER is {bundle_id} in both configurations",
        str(bundle_ids),
    )

    teams = pbxproj_settings(text, "DEVELOPMENT_TEAM")
    check(
        len(teams) == 2 and all(v.strip('"') == team_id for v in teams),
        f"DEVELOPMENT_TEAM is {team_id} in both configurations",
        str(teams),
    )

    versions = pbxproj_settings(text, "MARKETING_VERSION")
    check(
        len(versions) == 2 and all(v.strip('"') == marketing for v in versions),
        f"MARKETING_VERSION is {marketing} in both configurations",
        str(versions),
    )

    builds = pbxproj_settings(text, "CURRENT_PROJECT_VERSION")
    check(
        len(builds) == 2 and all(v.strip('"') == build for v in builds),
        f"CURRENT_PROJECT_VERSION is {build} in both configurations",
        str(builds),
    )

    check(
        len(pbxproj_settings(text, "CODE_SIGN_STYLE")) == 2
        and all(v.strip('"') == "Automatic" for v in pbxproj_settings(text, "CODE_SIGN_STYLE")),
        "CODE_SIGN_STYLE is Automatic",
    )
    check(
        text.count('ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;') == 2,
        "app icon asset is AppIcon",
    )
    check(
        '"1,2"' in (pbxproj_settings(text, "TARGETED_DEVICE_FAMILY")[0] if pbxproj_settings(text, "TARGETED_DEVICE_FAMILY") else ""),
        "TARGETED_DEVICE_FAMILY covers iPhone and iPad",
    )
    check(
        text.count("{") == text.count("}") and text.count("(") == text.count(")"),
        "project.pbxproj braces and parentheses balance",
    )
    scheme = REPO_ROOT / "ios" / "App" / "App.xcodeproj" / "xcshareddata" / "xcschemes" / "App.xcscheme"
    check(scheme.is_file(), "shared App scheme exists (xcodebuild -scheme App works in CI)")


def check_storekit() -> None:
    """v1.1.0: the Pro in-app purchase is a real native plugin, wired in."""
    print("StoreKit (Pro)")
    plugin = IOS_APP / "StoreKitPlugin.swift"
    if not plugin.is_file():
        fail(f"{plugin} is missing")
        return
    code = plugin.read_text(encoding="utf-8")
    check("import StoreKit" in code, "the plugin links StoreKit")
    check("CAPBridgedPlugin" in code, "the plugin is a Capacitor bridged plugin")
    check(
        'jsName = "IceWolfStoreKit"' in code,
        "the plugin jsName is IceWolfStoreKit (what game.json calls)",
    )
    for method in ("proStatus", "purchase", "restore"):
        check(f'name: "{method}"' in code, f"the plugin declares {method}()")
    check(f'productID = "{PRODUCT_ID}"' in code, f"the product id is {PRODUCT_ID}")
    check("Transaction.currentEntitlements" in code, "the entitlement is read from StoreKit 2")
    check("case .verified" in code, "transactions are only trusted when StoreKit verifies them")
    check("AppStore.sync()" in code, "restore asks the App Store to sync")
    check(
        "IceWolfBridgeViewController" in code and "registerPluginInstance(IceWolfStoreKitPlugin())" in code,
        "the bridge view controller registers the plugin",
    )

    scene = (IOS_APP / "SceneDelegate.swift").read_text(encoding="utf-8")
    check(
        "IceWolfBridgeViewController()" in scene,
        "SceneDelegate starts the app on the subclass that registers the plugin",
    )
    check(
        "CAPBridgeViewController()" not in scene,
        "SceneDelegate no longer starts a bare CAPBridgeViewController",
    )

    text = PBXPROJ.read_text(encoding="utf-8")
    check("StoreKitPlugin.swift in Sources" in text, "the plugin is in the App target's Sources phase")
    check(
        "StoreKitPlugin.swift */" in text,
        "the plugin has a file reference in the Xcode project",
    )

    game = REPO_ROOT / "game.json"
    if game.is_file():
        try:
            data = json.loads(game.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            fail(f"game.json does not parse: {error}")
        else:
            layout = next((item for item in data.get("layouts", []) if item.get("name") == "FROST LAB"), {})
            groups = [event.get("name") for event in layout.get("events", [])]
            check("v1.1.0 Pro 購入・復元UI" in groups, "game.json carries the Pro purchase group")
            blob = json.dumps(data, ensure_ascii=False)
            check(PRODUCT_ID in blob, f"the game asks for {PRODUCT_ID}")
            check("IceWolfStoreKit" in blob, "the game calls the IceWolfStoreKit plugin")


def check_assets() -> None:
    print("Assets")
    icon_dir = IOS_APP / "Assets.xcassets" / "AppIcon.appiconset"
    contents_path = icon_dir / "Contents.json"
    if not contents_path.is_file():
        fail(f"{contents_path} is missing")
        return
    contents = json.loads(contents_path.read_text(encoding="utf-8"))
    images = contents.get("images") or []
    check(len(images) == 1, "one universal app icon entry", str(len(images)))
    entry = images[0] if images else {}
    check(entry.get("size") == "1024x1024", "icon entry declares 1024x1024")
    check(entry.get("platform") == "ios", "icon entry targets iOS (unified single-size icon)")
    icon_path = icon_dir / entry.get("filename", "")
    if not icon_path.is_file():
        fail(f"app icon file {icon_path.name} is missing")
    else:
        (width, height), has_alpha = png_size_and_alpha(icon_path)
        check((width, height) == (1024, 1024), f"app icon is 1024x1024 ({width}x{height})")
        check(not has_alpha, "app icon has no alpha channel")

    splash_dir = IOS_APP / "Assets.xcassets" / "Splash.imageset"
    splash_contents = json.loads((splash_dir / "Contents.json").read_text(encoding="utf-8"))
    for image in splash_contents.get("images") or []:
        name = image.get("filename")
        check(bool(name) and (splash_dir / name).is_file(), f"launch image {name} exists")


def check_capacitor_config() -> None:
    print("capacitor.config.ts")
    if not CAP_CONFIG.is_file():
        fail(f"{CAP_CONFIG} is missing")
        return
    text = CAP_CONFIG.read_text(encoding="utf-8")
    check('appId: "jp.signlink.IceWolf"' in text, "appId is jp.signlink.IceWolf")
    check('appName: "ICE WOLF"' in text, "appName is ICE WOLF")
    check('webDir: "build"' in text, "webDir is build (GDevelop EXPORT_HTML5_EXTERNAL output)")
    check(
        re.search(r"^\s*server\s*:", text, re.MULTILINE) is None,
        "no server: override (the game ships fully offline in the app bundle)",
    )


def check_export(build_dir: Path) -> None:
    print(f"HTML5 export ({build_dir})")
    check((build_dir / "index.html").is_file(), "build/index.html exists")
    check((build_dir / "code0.js").is_file(), "build/code0.js exists")
    js = sorted(build_dir.glob("code*.js"))
    check(len(js) >= 1, f"game code bundles exported ({len(js)} file(s))")
    index = build_dir / "index.html"
    if index.is_file():
        html = index.read_text(encoding="utf-8", errors="replace")
        check("gd.js" in html, "index.html loads the GDevelop runtime")


def check_online_config(public_dir: Path) -> None:
    """v1.1.0: the built web layer names the Supabase project the game joins.

    The game reads `window.ICE_WOLF_ONLINE_CONFIG` first (docs/v110-online-setup.md
    §3). Without it a TestFlight build would only offer one-phone practice rooms,
    so a release build must carry it. A publishable (`sb_publishable_...`) or the
    legacy anon key is expected; a secret key must never be here.
    """
    print(f"Online config ({public_dir}/index.html)")
    index = public_dir / "index.html"
    if not index.is_file():
        fail(f"{index} is missing (cap sync did not produce the web layer)")
        return
    html = index.read_text(encoding="utf-8", errors="replace")
    if "ICE_WOLF_ONLINE_CONFIG" not in html:
        fail("index.html does not set window.ICE_WOLF_ONLINE_CONFIG")
        return
    ok("index.html sets window.ICE_WOLF_ONLINE_CONFIG")

    head_end = html.lower().rfind("</head>")
    check(head_end < 0 or html.index("ICE_WOLF_ONLINE_CONFIG") < head_end,
          "the config is set before </head>", "it would run after the game starts")

    project = re.search(r"url:\s*'(https://([a-z0-9]+)\.supabase\.co)'", html)
    check(project is not None, "the project URL is https://<ref>.supabase.co",
          "no url:'https://<ref>.supabase.co' entry" if project is None else "")
    if project:
        notes.append(f"online project: {project.group(2)}")

    key = re.search(r"key:\s*'([^']+)'", html)
    if key is None:
        fail("index.html does not carry a key for the online config")
        return
    value = key.group(1)
    check(len(value) >= 20, f"the shipped key is long enough ({len(value)} characters)")
    check(not value.startswith("sb_secret_") and "service_role" not in value,
          "the shipped key is the publishable (or legacy anon) key, never a secret")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bundle-id", default=DEFAULT_BUNDLE_ID)
    parser.add_argument("--team-id", default=DEFAULT_TEAM_ID)
    parser.add_argument("--marketing-version", default=DEFAULT_MARKETING_VERSION)
    parser.add_argument("--build-number", default=DEFAULT_BUILD_NUMBER)
    parser.add_argument("--build-dir", default="", help="also verify this HTML5 export folder")
    parser.add_argument("--public-dir", default=str(IOS_APP / "public"),
                        help="the web layer Capacitor copies into the app (default: ios/App/App/public)")
    parser.add_argument("--require-online-config", action="store_true",
                        help="require window.ICE_WOLF_ONLINE_CONFIG in the web layer (release builds do)")
    args = parser.parse_args()

    print(f"ICE WOLF iOS shell verification (repo {REPO_ROOT})")
    check_info_plist()
    check_pbxproj(args.bundle_id, args.team_id, args.marketing_version, args.build_number)
    check_storekit()
    check_assets()
    check_capacitor_config()
    if args.build_dir:
        check_export(Path(args.build_dir))
    if args.require_online_config:
        check_online_config(Path(args.public_dir))

    print()
    if failures:
        print(f"FAILED: {len(failures)} check(s)")
        for item in failures:
            print(f"  - {item}")
        return 1
    print("ALL CHECKS PASSED")
    for note in notes:
        print(f"note: {note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
