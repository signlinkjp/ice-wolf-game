# ICE WOLF

ICE WOLF is a 3D social-deduction freeze-tag game prototype built with GDevelop.

## Open the current prototype in GDevelop Web Editor

https://editor.gdevelop.io/?project=https%3A%2F%2Fraw.githubusercontent.com%2Fsignlinkjp%2F-ice-wolf-game%2Fmain%2Fgame.json

Raw project source:

https://raw.githubusercontent.com/signlinkjp/-ice-wolf-game/main/game.json

## Current development target

- 6 actors total: 1 player + 5 actors
- Wolf / Human roles
- 8-direction mobile D-pad
- Fixed overhead camera
- Freeze / Rescue / hidden Infection trap
- 5-minute match timer and win conditions
- CPU AI is the next major phase after Core Prototype validation

## Development workflow

The canonical project file is `game.json` on `main`.

Changes should be developed on branches and reviewed before merging into `main`. The current source is intentionally public so the GDevelop Web Editor can load the raw `game.json` directly on iPhone.

Current validation branch: `dev/core-validation`

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

Repository initialized for the GDevelop + GitHub iPhone workflow on 2026-09-13. `game.json` was materialized and byte-validated by GitHub Actions from the current CoreFix v0.2 project source before being committed to `main`.
