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

## Status

Repository initialized for the GDevelop + GitHub iPhone workflow on 2026-09-13. `game.json` was materialized and byte-validated by GitHub Actions from the current CoreFix v0.2 project source before being committed to `main`.
