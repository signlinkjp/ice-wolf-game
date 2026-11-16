#!/usr/bin/env bash
#
# ICE WOLF — build a signed iOS archive and (optionally) upload it to TestFlight.
#
# This is the reproducible local/CI entry point for the iOS shell:
#
#   1. GDevelop 5.6.282 HTML5 export of game.json -> build/
#      (skipped with --skip-export when build/ was produced elsewhere,
#       which is what .github/workflows/ios-testflight.yml does)
#   2. npm ci                                    (Capacitor 8.6.2, locked)
#   3. npx cap sync ios                          (build/ -> ios/App/App/public)
#   4. static verification of the iOS shell      (scripts/ios/verify-ios-project.py)
#   5. xcodebuild archive                        (automatic signing via the API key)
#   6. xcodebuild -exportArchive                 (re-signed for App Store distribution)
#   7. IPA verification                          (bundle id, versions, codesign, profile)
#   8. optional: read-only App Store Connect duplicate check + altool upload to TestFlight
#
# Signing uses the App Store Connect API key triplet that is already used by
# signlinkjp/bridge-sign-chat and signlinkjp/eleven-game-fresh:
#
#   APPLE_KEY_ID      -> secret ASC_ADMIN_AB_KEY_ID
#   APPLE_ISSUER_ID   -> secret ASC_ADMIN_AB_ISSUER_ID
#   APPLE_P8_BASE64   -> secret ASC_ADMIN_AB_KEY_P8_BASE64   (or APPLE_P8_PATH to an existing .p8)
#
# No .p12 and no .mobileprovision are needed: xcodebuild -allowProvisioningUpdates
# asks Apple for the distribution certificate and the App Store profile itself.
#
# Usage:
#   APPLE_KEY_ID=... APPLE_ISSUER_ID=... APPLE_P8_PATH=~/AuthKey_XXX.p8 \
#     bash scripts/ios/build-and-upload-testflight.sh --build-number 1
#
#   ... --upload            # after the build passed, upload this exact IPA
#   ... --skip-export       # reuse an existing build/ folder
#   ... --gdevelop-app "/Applications/GDevelop 5.app"
#
# Environment switches:
#   ICEWOLF_UPLOAD_CONFIRM=1   required together with --upload
#   MARKETING_VERSION / BUILD_NUMBER  override the Xcode project values
#   BUNDLE_ID / TEAM_ID               override the defaults below
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

DEFAULT_BUNDLE_ID="jp.signlink.IceWolf"
DEFAULT_TEAM_ID="TGBNH8WJV6"
XCODE_PROJECT="ios/App/App.xcodeproj"
SCHEME="App"

BUNDLE_ID="${BUNDLE_ID:-$DEFAULT_BUNDLE_ID}"
TEAM_ID="${TEAM_ID:-$DEFAULT_TEAM_ID}"
MARKETING_VERSION="${MARKETING_VERSION:-}"
BUILD_NUMBER="${BUILD_NUMBER:-}"

DO_UPLOAD="no"
SKIP_EXPORT="no"
ARTIFACT_DIR=""
GDEVELOP_BIN="${GDEVELOP_BIN:-}"
GDEVELOP_APP="${GDEVELOP_APP:-}"

usage() {
  sed -n '2,45p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --upload) DO_UPLOAD="yes" ;;
    --skip-export) SKIP_EXPORT="yes" ;;
    --build-number) BUILD_NUMBER="${2:?--build-number needs a value}"; shift ;;
    --marketing-version) MARKETING_VERSION="${2:?--marketing-version needs a value}"; shift ;;
    --artifacts-dir) ARTIFACT_DIR="${2:?--artifacts-dir needs a value}"; shift ;;
    --gdevelop-bin) GDEVELOP_BIN="${2:?--gdevelop-bin needs a value}"; shift ;;
    --gdevelop-app) GDEVELOP_APP="${2:?--gdevelop-app needs a value}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1 (try --help)" >&2; exit 2 ;;
  esac
  shift
done

STEP_NO=0
step() {
  STEP_NO=$((STEP_NO + 1))
  printf '\n===== [%d] %s =====\n' "$STEP_NO" "$1"
}
info() { printf '  %s\n' "$*"; }
die() {
  printf '\nSTOP: %s\n' "$*" >&2
  exit 1
}

cd "$REPO_ROOT"

# --------------------------------------------------------------------------
# 0. Preflight
# --------------------------------------------------------------------------
step "preflight (macOS, Xcode, Node)"
[ "$(uname -s)" = "Darwin" ] || die "this script signs and archives iOS apps and must run on macOS"
command -v xcodebuild >/dev/null 2>&1 || die "xcodebuild not found — install Xcode"
command -v npm >/dev/null 2>&1 || die "npm not found — install Node 20 or newer"
command -v python3 >/dev/null 2>&1 || die "python3 not found"
[ -f "$REPO_ROOT/game.json" ] || die "game.json not found — run this from the ICE WOLF repository"
[ -d "$REPO_ROOT/$XCODE_PROJECT" ] || die "$XCODE_PROJECT not found"

GIT_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
if [ -n "$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null || true)" ]; then
  info "note: working tree has uncommitted changes; the IPA is built from the files on disk (git $GIT_SHA)"
fi
info "repository: $REPO_ROOT (git $GIT_SHA)"
info "Xcode: $(xcodebuild -version | tr '\n' ' ')"
info "Node: $(node --version) / npm: $(npm --version)"

# Version defaults come from the project file, so the app version lives in one place.
if [ -z "$MARKETING_VERSION" ]; then
  MARKETING_VERSION="$(sed -n 's/.*MARKETING_VERSION = \(.*\);/\1/p' "$REPO_ROOT/$XCODE_PROJECT/project.pbxproj" | head -n 1)"
fi
if [ -z "$BUILD_NUMBER" ]; then
  BUILD_NUMBER="$(sed -n 's/.*CURRENT_PROJECT_VERSION = \(.*\);/\1/p' "$REPO_ROOT/$XCODE_PROJECT/project.pbxproj" | head -n 1)"
fi
[ -n "$MARKETING_VERSION" ] || die "could not read MARKETING_VERSION from the Xcode project"
[ -n "$BUILD_NUMBER" ] || die "could not read CURRENT_PROJECT_VERSION from the Xcode project"
case "$BUILD_NUMBER" in
  ''|*[!0-9]*) die "build number must be a positive integer, got '$BUILD_NUMBER'" ;;
esac
[ "$BUILD_NUMBER" -ge 1 ] || die "build number must be 1 or higher"

if [ -z "$ARTIFACT_DIR" ]; then
  ARTIFACT_DIR="$REPO_ROOT/artifacts/ios/${MARKETING_VERSION}-${BUILD_NUMBER}"
fi
mkdir -p "$ARTIFACT_DIR"
ARTIFACT_DIR="$(cd "$ARTIFACT_DIR" && pwd)"
LOG_FILE="$ARTIFACT_DIR/build.log"
: > "$LOG_FILE"
info "marketing version $MARKETING_VERSION, build $BUILD_NUMBER, bundle id $BUNDLE_ID, team $TEAM_ID"
info "artifacts: $ARTIFACT_DIR"
info "log: $LOG_FILE"

SECRET_DIR=""
cleanup() {
  if [ -n "$SECRET_DIR" ] && [ -d "$SECRET_DIR" ]; then
    rm -rf "$SECRET_DIR"
  fi
}
trap cleanup EXIT

# --------------------------------------------------------------------------
# 1. HTML5 export
# --------------------------------------------------------------------------
step "HTML5 export (GDevelop -> build/)"
if [ "$SKIP_EXPORT" = "yes" ]; then
  [ -f "$REPO_ROOT/build/index.html" ] || die "--skip-export was given but build/index.html does not exist"
  info "using the existing build/ folder"
else
  if [ -z "$GDEVELOP_BIN" ]; then
    if [ -z "$GDEVELOP_APP" ]; then
      for candidate in "/Applications/GDevelop 5.app" "$HOME/Applications/GDevelop 5.app"; do
        if [ -d "$candidate" ]; then GDEVELOP_APP="$candidate"; break; fi
      done
    fi
    if [ -n "$GDEVELOP_APP" ]; then
      GDEVELOP_BIN="$GDEVELOP_APP/Contents/MacOS/GDevelop 5"
    fi
  fi
  [ -n "$GDEVELOP_BIN" ] && [ -x "$GDEVELOP_BIN" ] \
    || die "GDevelop 5.6.282 not found — pass --gdevelop-app/--gdevelop-bin, or export build/ elsewhere and use --skip-export"
  info "GDevelop: $GDEVELOP_BIN"
  rm -rf "$REPO_ROOT/build"
  if ! "$GDEVELOP_BIN" --no-sandbox --disable-update-check \
      --run-command EXPORT_HTML5_EXTERNAL "$REPO_ROOT/game.json" >>"$LOG_FILE" 2>&1; then
    tail -n 40 "$LOG_FILE" >&2 || true
    die "GDevelop export failed (full log: $LOG_FILE)"
  fi
  rm -rf "$REPO_ROOT/build/.git"
  info "exported $(du -sh "$REPO_ROOT/build" | cut -f1) into build/"
fi
[ -f "$REPO_ROOT/build/index.html" ] || die "build/index.html is missing after export"

# --------------------------------------------------------------------------
# 2. Capacitor dependencies
# --------------------------------------------------------------------------
step "npm ci (Capacitor 8.6.2)"
if [ -f "$REPO_ROOT/package-lock.json" ]; then
  npm ci --no-audit --no-fund --prefix "$REPO_ROOT" >>"$LOG_FILE" 2>&1 \
    || { tail -n 30 "$LOG_FILE" >&2; die "npm ci failed"; }
else
  info "package-lock.json not found, falling back to npm install"
  npm install --no-audit --no-fund --prefix "$REPO_ROOT" >>"$LOG_FILE" 2>&1 \
    || { tail -n 30 "$LOG_FILE" >&2; die "npm install failed"; }
fi
info "installed $(node -e "console.log('@capacitor/ios ' + require('$REPO_ROOT/node_modules/@capacitor/ios/package.json').version)")"

# --------------------------------------------------------------------------
# 3. Sync the export into the native project
# --------------------------------------------------------------------------
step "npx cap sync ios (build/ -> ios/App/App/public)"
CAP_BIN="$REPO_ROOT/node_modules/.bin/cap"
[ -x "$CAP_BIN" ] || die "the Capacitor CLI is not installed (node_modules/.bin/cap missing)"
( cd "$REPO_ROOT" && "$CAP_BIN" sync ios >>"$LOG_FILE" 2>&1 ) \
  || { tail -n 40 "$LOG_FILE" >&2; die "cap sync ios failed"; }
[ -f "$REPO_ROOT/ios/App/App/public/index.html" ] || die "ios/App/App/public/index.html is missing after cap sync"
info "public/ contains $(find "$REPO_ROOT/ios/App/App/public" -type f | wc -l | tr -d ' ') files"

# --------------------------------------------------------------------------
# 4. Static verification of the shell
# --------------------------------------------------------------------------
step "verify the iOS shell (landscape lock, full screen, icon, versions)"
python3 "$REPO_ROOT/scripts/ios/verify-ios-project.py" \
  --bundle-id "$BUNDLE_ID" \
  --team-id "$TEAM_ID" \
  --marketing-version "$MARKETING_VERSION" \
  --build-number "$BUILD_NUMBER" \
  --build-dir "$REPO_ROOT/build" || die "iOS shell verification failed"

# --------------------------------------------------------------------------
# 5. App Store Connect API key
# --------------------------------------------------------------------------
step "prepare the App Store Connect API key"
APPLE_KEY_ID="${APPLE_KEY_ID:-}"
APPLE_ISSUER_ID="${APPLE_ISSUER_ID:-}"
[ -n "$APPLE_KEY_ID" ] || die "APPLE_KEY_ID is not set (GitHub secret ASC_ADMIN_AB_KEY_ID)"
[ -n "$APPLE_ISSUER_ID" ] || die "APPLE_ISSUER_ID is not set (GitHub secret ASC_ADMIN_AB_ISSUER_ID)"

if [ -n "${APPLE_P8_PATH:-}" ]; then
  [ -f "$APPLE_P8_PATH" ] || die "APPLE_P8_PATH does not exist"
  KEY_PATH="$APPLE_P8_PATH"
  info "using the existing .p8 at $APPLE_P8_PATH"
else
  [ -n "${APPLE_P8_BASE64:-}" ] || die "set APPLE_P8_BASE64 (GitHub secret ASC_ADMIN_AB_KEY_P8_BASE64) or APPLE_P8_PATH"
  umask 077
  SECRET_DIR="$(mktemp -d "${TMPDIR:-/tmp}/icewolf-asc-XXXXXX")"
  KEY_PATH="$SECRET_DIR/AuthKey_${APPLE_KEY_ID}.p8"
  printf '%s' "$APPLE_P8_BASE64" \
    | python3 -c 'import base64,sys; sys.stdout.buffer.write(base64.b64decode(b"".join(sys.stdin.buffer.read().split()),validate=True))' > "$KEY_PATH"
  chmod 600 "$KEY_PATH"
  info "decoded the API key into a private temporary file (deleted on exit)"
fi
grep -q -- '-----BEGIN PRIVATE KEY-----' "$KEY_PATH" || die "the API key is not a valid .p8 private key"

# --------------------------------------------------------------------------
# 6. Archive
# --------------------------------------------------------------------------
step "xcodebuild archive (Release, automatic signing)"
ARCHIVE_PATH="$ARTIFACT_DIR/ICE WOLF.xcarchive"
EXPORT_PATH="$ARTIFACT_DIR/export"
rm -rf "$ARCHIVE_PATH" "$EXPORT_PATH"

# Same archive shape as signlinkjp/bridge-sign-chat (Capacitor 8.6.2 + SPM): the
# archive signs automatically with the API key, and -exportArchive re-signs for
# App Store distribution.
if ! xcodebuild archive \
      -project "$REPO_ROOT/$XCODE_PROJECT" \
      -scheme "$SCHEME" \
      -configuration Release \
      -destination 'generic/platform=iOS' \
      -archivePath "$ARCHIVE_PATH" \
      -allowProvisioningUpdates \
      -authenticationKeyPath "$KEY_PATH" \
      -authenticationKeyID "$APPLE_KEY_ID" \
      -authenticationKeyIssuerID "$APPLE_ISSUER_ID" \
      DEVELOPMENT_TEAM="$TEAM_ID" \
      CODE_SIGN_STYLE=Automatic \
      CODE_SIGN_IDENTITY="" \
      CODE_SIGNING_REQUIRED=NO \
      CODE_SIGNING_ALLOWED=NO \
      CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
      MARKETING_VERSION="$MARKETING_VERSION" >>"$LOG_FILE" 2>&1; then
  grep -E "error:|Error Domain" "$LOG_FILE" | tail -n 30 >&2 || true
  die "xcodebuild archive failed — if this is the first build, confirm the App Store Connect app record and the bundle id exist for team $TEAM_ID (full log: $LOG_FILE)"
fi
APP_IN_ARCHIVE="$ARCHIVE_PATH/Products/Applications/App.app"
[ -d "$APP_IN_ARCHIVE" ] || die "App.app is missing from the archive"
ARCHIVED_BUILD="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP_IN_ARCHIVE/Info.plist")"
[ "$ARCHIVED_BUILD" = "$BUILD_NUMBER" ] || die "archive build number is $ARCHIVED_BUILD, expected $BUILD_NUMBER"
info "archived App.app (build $ARCHIVED_BUILD)"

# --------------------------------------------------------------------------
# 7. Export a signed IPA (automatic signing via the API key)
# --------------------------------------------------------------------------
step "xcodebuild -exportArchive (App Store distribution signing)"
mkdir -p "$EXPORT_PATH"
EXPORT_OPTIONS="$ARTIFACT_DIR/ExportOptions.plist"
python3 - "$EXPORT_OPTIONS" "$TEAM_ID" <<'PY'
import plistlib, sys
with open(sys.argv[1], "wb") as handle:
    plistlib.dump(
        {
            "method": "app-store-connect",
            "destination": "export",
            "signingStyle": "automatic",
            "teamID": sys.argv[2],
            "manageAppVersionAndBuildNumber": False,
            "uploadSymbols": True,
            "stripSwiftSymbols": True,
        },
        handle,
    )
PY

if ! xcodebuild -exportArchive \
      -archivePath "$ARCHIVE_PATH" \
      -exportPath "$EXPORT_PATH" \
      -exportOptionsPlist "$EXPORT_OPTIONS" \
      -allowProvisioningUpdates \
      -authenticationKeyPath "$KEY_PATH" \
      -authenticationKeyID "$APPLE_KEY_ID" \
      -authenticationKeyIssuerID "$APPLE_ISSUER_ID" >>"$LOG_FILE" 2>&1; then
  grep -E "error:|Error Domain" "$LOG_FILE" | tail -n 30 >&2 || true
  die "exportArchive failed — if this is the first upload, confirm the App Store Connect app record and the bundle id exist for team $TEAM_ID (full log: $LOG_FILE)"
fi
IPA_PATH="$(find "$EXPORT_PATH" -maxdepth 1 -type f -name '*.ipa' -print -quit)"
[ -n "$IPA_PATH" ] || die "no .ipa was produced"
[ "$(find "$EXPORT_PATH" -maxdepth 1 -type f -name '*.ipa' | wc -l | tr -d ' ')" = "1" ] || die "more than one .ipa was produced"
info "IPA: $IPA_PATH"

# --------------------------------------------------------------------------
# 8. Verify the signed IPA
# --------------------------------------------------------------------------
step "verify the signed IPA"
INSPECT_DIR="$ARTIFACT_DIR/inspect"
rm -rf "$INSPECT_DIR"
mkdir -p "$INSPECT_DIR"
unzip -q "$IPA_PATH" 'Payload/*' -d "$INSPECT_DIR"
APP_PATH="$INSPECT_DIR/Payload/App.app"
[ -f "$APP_PATH/Info.plist" ] || die "Payload/App.app/Info.plist is missing"

IPA_BUNDLE="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP_PATH/Info.plist")"
IPA_SHORT_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP_PATH/Info.plist")"
IPA_BUILD="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP_PATH/Info.plist")"
[ "$IPA_BUNDLE" = "$BUNDLE_ID" ] || die "IPA bundle id is $IPA_BUNDLE, expected $BUNDLE_ID"
[ "$IPA_SHORT_VERSION" = "$MARKETING_VERSION" ] || die "IPA marketing version is $IPA_SHORT_VERSION, expected $MARKETING_VERSION"
[ "$IPA_BUILD" = "$BUILD_NUMBER" ] || die "IPA build number is $IPA_BUILD, expected $BUILD_NUMBER"
info "bundle id $IPA_BUNDLE, version $IPA_SHORT_VERSION ($IPA_BUILD)"

codesign --verify --deep --strict "$APP_PATH" || die "codesign verification failed"
codesign -dv --verbose=4 "$APP_PATH" 2>&1 | grep -Fx "TeamIdentifier=$TEAM_ID" >/dev/null \
  || die "the IPA is not signed by team $TEAM_ID"
info "code signature valid, TeamIdentifier $TEAM_ID"

[ -s "$APP_PATH/embedded.mobileprovision" ] || die "embedded.mobileprovision is missing"
security cms -D -i "$APP_PATH/embedded.mobileprovision" > "$INSPECT_DIR/profile.plist"
python3 - "$INSPECT_DIR/profile.plist" "$TEAM_ID" "$BUNDLE_ID" <<'PY'
import datetime, plistlib, sys
with open(sys.argv[1], "rb") as handle:
    profile = plistlib.load(handle)
team, bundle = sys.argv[2], sys.argv[3]
assert team in profile.get("TeamIdentifier", []), "provisioning profile is for another team"
entitlements = profile["Entitlements"]
assert entitlements.get("application-identifier") == f"{team}.{bundle}", "profile application-identifier mismatch"
assert entitlements.get("get-task-allow") is False, "profile is a development profile, not App Store distribution"
expiry = profile["ExpirationDate"]
if expiry.tzinfo is None:
    expiry = expiry.replace(tzinfo=datetime.timezone.utc)
assert expiry > datetime.datetime.now(datetime.timezone.utc), "provisioning profile has expired"
print(f"  PASS  App Store distribution profile for {bundle} (expires {expiry:%Y-%m-%d})")
PY

IPA_SHA256="$(shasum -a 256 "$IPA_PATH" | awk '{print $1}')"
IPA_SIZE="$(stat -f%z "$IPA_PATH")"
info "sha256 $IPA_SHA256 ($IPA_SIZE bytes)"

# --------------------------------------------------------------------------
# 9. Optional TestFlight upload
# --------------------------------------------------------------------------
UPLOAD_RESULT="not requested"
if [ "$DO_UPLOAD" = "yes" ]; then
  step "read-only App Store Connect check, then TestFlight upload"
  [ "${ICEWOLF_UPLOAD_CONFIRM:-}" = "1" ] \
    || die "refusing to upload: set ICEWOLF_UPLOAD_CONFIRM=1 to confirm the TestFlight upload of build $BUILD_NUMBER"
  APPLE_KEY_ID="$APPLE_KEY_ID" APPLE_ISSUER_ID="$APPLE_ISSUER_ID" APPLE_P8_PATH="$KEY_PATH" \
    python3 "$REPO_ROOT/scripts/ios/asc-readonly-preflight.py" --build "$BUILD_NUMBER" --bundle-id "$BUNDLE_ID" \
    || die "the App Store Connect preflight stopped the upload (see the HOLD reason above)"

  [ "$(shasum -a 256 "$IPA_PATH" | awk '{print $1}')" = "$IPA_SHA256" ] || die "the IPA changed before upload"
  if ! xcrun altool --upload-app \
        --file "$IPA_PATH" \
        --type ios \
        --apiKey "$APPLE_KEY_ID" \
        --apiIssuer "$APPLE_ISSUER_ID" \
        --p8-file-path "$KEY_PATH" >>"$LOG_FILE" 2>&1; then
    grep -E "ERROR|Error|error" "$LOG_FILE" | tail -n 20 >&2 || true
    die "altool upload failed — check App Store Connect before retrying (full log: $LOG_FILE)"
  fi
  [ "$(shasum -a 256 "$IPA_PATH" | awk '{print $1}')" = "$IPA_SHA256" ] || die "the IPA changed during upload"
  UPLOAD_RESULT="submitted to TestFlight (Apple processing continues asynchronously)"
  info "$UPLOAD_RESULT"
else
  step "TestFlight upload skipped (no --upload)"
  info "re-run with --upload ICEWOLF_UPLOAD_CONFIRM=1 to send this build to TestFlight"
fi

# --------------------------------------------------------------------------
# 10. Provenance manifest
# --------------------------------------------------------------------------
step "write provenance manifest"
GAME_JSON_SHA256="$(shasum -a 256 "$REPO_ROOT/game.json" | awk '{print $1}')"
python3 - "$ARTIFACT_DIR/manifest.json" <<PY
import json, datetime, os
manifest = {
    "app": "ICE WOLF",
    "bundle_id": "$BUNDLE_ID",
    "team_id": "$TEAM_ID",
    "marketing_version": "$MARKETING_VERSION",
    "build_number": "$BUILD_NUMBER",
    "git_sha": "$GIT_SHA",
    "game_json_sha256": "$GAME_JSON_SHA256",
    "ipa_sha256": "$IPA_SHA256",
    "ipa_size_bytes": int("$IPA_SIZE"),
    "capacitor_ios": "$(node -e "console.log(require('$REPO_ROOT/node_modules/@capacitor/ios/package.json').version)")",
    "xcode": " ".join(os.popen("xcodebuild -version").read().split()),
    "signed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    "testflight_upload": "$UPLOAD_RESULT",
}
with open("$ARTIFACT_DIR/manifest.json", "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
print(json.dumps(manifest, ensure_ascii=False, indent=2))
PY

printf '\n===== RESULT =====\n'
printf 'IPA_PATH=%s\n' "$IPA_PATH"
printf 'IPA_SHA256=%s\n' "$IPA_SHA256"
printf 'BUNDLE_ID=%s\n' "$BUNDLE_ID"
printf 'VERSION=%s (%s)\n' "$MARKETING_VERSION" "$BUILD_NUMBER"
printf 'ARCHIVE=%s\n' "$ARCHIVE_PATH"
printf 'MANIFEST=%s\n' "$ARTIFACT_DIR/manifest.json"
printf 'UPLOAD=%s\n' "$UPLOAD_RESULT"
printf '\nNext: App Store Connect > TestFlight > ICE WOLF > Build %s (processing usually takes 5-30 min).\n' "$BUILD_NUMBER"
