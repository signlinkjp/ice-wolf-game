# ICE WOLF

ICE WOLF is a 3D social-deduction freeze-tag game built with GDevelop.

**v1.0.0** is the first world release: the whole interface is localised into
twelve languages (Japanese, English, Simplified and Traditional Chinese, Korean,
Spanish, French, German, Portuguese, Italian, Hindi, Indonesian), chosen on first
launch from the device language or by hand, and switchable at any time from
SETTINGS. See `docs/v100-world-release.md` for how the text layer works.

**v1.1.0** (branch `feat/ice-wolf-v1.1.0-pro`) is the Pro release, in two parts:

- the Pro in-app purchase foundation: a StoreKit 2 plugin for the non-consumable
  `jp.signlink.IceWolf.pro`, a purchase / restore screen reachable from the menu
  and SETTINGS, and the twelve-language lines for it (`docs/v110-pro-iap.md`);
- **Phase 1 gameplay**: five new stages (Deep-Sea Aquarium free, Misty Amusement
  Park / Snowy Mountain Lodge / Abandoned School / Spaceship with Pro) with their
  own floor plans and atmosphere, stage-linked block-toy outfits, matches of up to
  10 players with two wolves, Pro custom rules (switch count, 1 / 10 minutes) and
  a spectator camera that follows a living player while you are frozen
  (`docs/v110-phase1-stages.md`);
- **Phase 2 online**: a room with a six-character code, seats and READY, a host
  who owns the round, and eight one-tap stamps that every phone reads in its own
  of the twelve languages. Rooms run over Supabase Realtime (Broadcast + Presence,
  no tables, no RLS, no library fetched at run time) behind a `RealtimeTransport`
  interface with an in-memory hub for the tests. Creating a room and the ten
  player / two wolf / custom rules are Pro; joining Classic and Deep-Sea Aquarium
  is free, joining a Pro stage is not (`docs/v110-online-setup.md`).

The movement, hitbox, camera distances, freeze/rescue, switch hold, stairs, warp
and AI keep their 1.0.0 numbers; `tests/pro/scope-guard.test.mjs` compares them
with `main` on every run.

## Open the project in the GDevelop Web Editor

https://editor.gdevelop.io/?project=https%3A%2F%2Fraw.githubusercontent.com%2Fsignlinkjp%2F-ice-wolf-game%2Fmain%2Fgame.json

Raw project source:

https://raw.githubusercontent.com/signlinkjp/-ice-wolf-game/main/game.json

## What the game is

- 7 to 10 players on two floors: 1 human player + up to 9 CPUs, 1 or 2 wolves
- Six stages: Classic Ice Arena, Deep-Sea Aquarium (free), Misty Amusement Park,
  Snowy Mountain Lodge, Abandoned School, Spaceship (Pro), each with its own
  interior walls, palette, atmosphere and outfits
- Wolf / Human roles, 5-second Wolf Mode, freeze and hold-to-rescue
- Spectator camera: when you are frozen, follow any living player with ‹ ›
- One secret "wolf role" designation per match (the rescue that is a trap)
- 2 / 3 / 5 minute matches (1 / 10 with Pro), speed floors, warp pads, stairs between 1F and 2F
- Five switches (three correct; 3 / 4 with Pro) and three gates; the gate escape wins for the humans
- Compact virtual joystick, normal and overhead camera, effects-only sound
- Online rooms (up to 10 phones) with eight translated quick stamps; the host
  phone runs the round and the guests see the same arena, roles and HUD

## Development workflow

The canonical project file is `game.json` on `main`.

Changes should be developed on branches and reviewed before merging into `main`. The current source is intentionally public so the GDevelop Web Editor can load the raw `game.json` directly on iPhone.

Current release: `main` at v1.0.0 (Build 12, in App Store review). `v1.1.0`
(Pro purchase foundation) is developed on `feat/ice-wolf-v1.1.0-pro` and is not
merged into `main` until 1.0.0 is approved.

## iOS app (TestFlight)

The iPhone app is the GDevelop HTML5 export wrapped in a Capacitor 8.6.2 shell:

```bash
npm ci                                  # Capacitor 8.6.2, locked
npx cap sync ios                        # build/ -> ios/App/App/public
python3 scripts/ios/verify-ios-project.py   # landscape lock, icon, versions, StoreKit (no Mac needed)
npm test                                # Pro store + 12 languages + stages + roster + online + no-gameplay-change guards
```

`.github/workflows/ios-testflight.yml` exports the game on Ubuntu, then archives,
signs and (optionally) uploads it to TestFlight on a macOS runner using the same
App Store Connect API key secrets as the other signlinkjp apps.

- Bundle ID: `jp.signlink.IceWolf` / team `TGBNH8WJV6`
- Landscape only, full screen, status bar hidden
- Full setup, App Store Connect and GitHub Secrets steps: `docs/ios-testflight-setup.md`

## Status

Repository initialized for the GDevelop + GitHub iPhone workflow on 2026-09-13.
Shipped: **v1.0.0 (Build 12)** — twelve languages, first-launch language picker,
`ICE WOLF v1.0.0` build markers, and the Build 8 map: every attraction one size
down, the warp pads out of the stair corners (`docs/v100-build8-map.md`).
In progress: **v1.1.0 (Build 15)** — the Pro purchase foundation, Phase 1
(6 stages, outfits, 10 players, 2 wolves, custom rules, spectator camera) and
Phase 2 (online rooms, host authority, eight translated quick stamps) on
`feat/ice-wolf-v1.1.0-pro` (`docs/v110-pro-iap.md`, `docs/v110-phase1-stages.md`,
`docs/v110-online-setup.md`).
The online rooms need one external step: a Supabase project URL and its anon key
(`docs/v110-online-setup.md` §3). Until they are set the game says so and the
lobby runs as a one-phone practice room. Remote players' positions are received
and validated but not yet drawn by the 3D scene — that swap of the CPU block is
the next build (`docs/v110-online-setup.md` §7).
Version history and the verification of each step live in `docs/`.
