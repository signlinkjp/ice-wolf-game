# ICE WOLF

ICE WOLF is a 3D social-deduction freeze-tag game built with GDevelop.

**v1.0.0** is the first world release: the whole interface is localised into
twelve languages (Japanese, English, Simplified and Traditional Chinese, Korean,
Spanish, French, German, Portuguese, Italian, Hindi, Indonesian), chosen on first
launch from the device language or by hand, and switchable at any time from
SETTINGS. See `docs/v100-world-release.md` for how the text layer works.

## Open the project in the GDevelop Web Editor

https://editor.gdevelop.io/?project=https%3A%2F%2Fraw.githubusercontent.com%2Fsignlinkjp%2F-ice-wolf-game%2Fmain%2Fgame.json

Raw project source:

https://raw.githubusercontent.com/signlinkjp/-ice-wolf-game/main/game.json

## What the game is

- 7 players on two floors (FROST LAB): 1 human player + 6 CPUs
- Wolf / Human roles, 5-second Wolf Mode, freeze and hold-to-rescue
- One secret "wolf role" designation per match (the rescue that is a trap)
- 2 / 3 / 5 minute matches, speed floors, warp pads, stairs between 1F and 2F
- Five switches (three correct) and three gates; the gate escape wins for the humans
- Compact virtual joystick, normal and overhead camera, effects-only sound

## Development workflow

The canonical project file is `game.json` on `main`.

Changes should be developed on branches and reviewed before merging into `main`. The current source is intentionally public so the GDevelop Web Editor can load the raw `game.json` directly on iPhone.

Current release: `main` at v1.0.0 (Build 7).

## iOS app (TestFlight)

The iPhone app is the GDevelop HTML5 export wrapped in a Capacitor 8.6.2 shell:

```bash
npm ci                                  # Capacitor 8.6.2, locked
npx cap sync ios                        # build/ -> ios/App/App/public
python3 scripts/ios/verify-ios-project.py   # landscape lock, icon, versions (no Mac needed)
```

`.github/workflows/ios-testflight.yml` exports the game on Ubuntu, then archives,
signs and (optionally) uploads it to TestFlight on a macOS runner using the same
App Store Connect API key secrets as the other signlinkjp apps.

- Bundle ID: `jp.signlink.IceWolf` / team `TGBNH8WJV6`
- Landscape only, full screen, status bar hidden
- Full setup, App Store Connect and GitHub Secrets steps: `docs/ios-testflight-setup.md`

## Status

Repository initialized for the GDevelop + GitHub iPhone workflow on 2026-09-13.
Current release: **v1.0.0 (Build 7)** — twelve languages, first-launch language
picker, `ICE WOLF v1.0.0` build markers. Version history and the verification of
each step live in `docs/`.
