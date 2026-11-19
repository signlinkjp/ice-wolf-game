# Build 26 — the four notes from Build 25

Build 25 was played through on an iPhone, and four things came back: two overlaps
at the top of the screen, one banner in the middle of the ice, and a match that
could carry a fourth wolf. This build is those four. `npm test` runs 223 checks;
`tests/pro/v113-build26.test.mjs` carries the ones that belong to this build, and
the two older files were re-pointed where a rule changed under them.

## A. The screen

1. **The world's pills keep out of the HUD.** `🔒 LOCK`, `◆`/`✓ ON` and `🪜 1F→2F`
   are DOM boxes drawn over the canvas, so they painted over whatever GDevelop had
   written there; the play found the corner ones covering `スイッチ: 2/3` and
   `ゲート: 閉鎖中 ×3` (`IMG_4044`). Every pill is now placed against the five bands
   the HUD lives in (`ICE_WOLF_HUD_BANDS`): the corner block, the clock and the
   banner under it, the MENU/CAM corner with the STATUS line and the wolf's board,
   the joystick, and the hold button with the rescue ring. A pill goes above its
   pad first, drops under it when the top is taken (`iceWolfLabelSpot`), and is not
   drawn at all when both would hide a HUD line — a pad still reads from its own
   colour, and the line it would have covered is the one the player needs most.
   The pill's own size is measured once per text and kept on the element, so
   seventeen pills do not lay the page out every frame.

2. **`ICE WOLF v1.1.0` leaves the STATUS row.** It shared the top-right with
   `人間：凍った仲間を救助しよう` / `人狼モード使用可能` (`IMG_4044`, `IMG_4045`).
   The label is now in the bottom-right corner (1000, 660 of 1280×720, 18px),
   which is free in every state: the joystick is bottom-left, the hold button and
   the rescue ring bottom-centre, MENU / CAM and the wolf's board top-right.

3. **The stage banner is a slim pill under the clock.** `🎢 …`, `🪐 …`, `🚀 …` and
   `🔒 教室ロック中 あと○秒` used to be a 22px slab across the bottom-centre of the
   ice (`IMG_4045`). It is now one line, 10–13px with thin padding, pinned under
   the clock (its top is measured from the canvas at 0.105 of the height, because
   the view is letterboxed on some devices) and it never covers the play area. The
   coaster line was shortened to `🎢 全員スピードUP あと○秒` in twelve languages —
   the stage card still names the ride.

## B. The rule

4. **Three wolves at most.** A ten-player Pro match could open with two wolves, add
   the recruit and then the trap switch, and stand at four wolves against six humans
   — the `4 対 6` the play asked to stop. The ceiling is now three, and the trap
   switch — which always adds a wolf — is not dealt in a match that already opens
   with two (`iceWolfTrapAllowed`, `ICE_WOLF_WOLF_MAX`), whatever SETTINGS says:
   - one wolf at the start: 1 + the recruit + the trap = **3**;
   - two wolves at the start: 2 + the recruit = **3**, and no trap pad on the map.

   The pick (`WolfRolePickOpen`, both the player's designation and a guest's request
   through the host), a CPU wolf's infection (`wolvesMax` 4 → 3) and the trap itself
   all ask the same ceiling, so no order of events can reach four. The pack's size
   and ceiling are published as `WolfTotal` / `WolfMax` for the blocks that run at
   other points of the sheet. SETTINGS says so in twelve languages
   (`settings.trapNoteTwoWolves`), and HOW TO PLAY gained one line per language.

## The build

`CURRENT_PROJECT_VERSION = 26` in both configurations and in the verifier; the
GDevelop project stays `1.1.0`. `python3 scripts/ios/verify-ios-project.py` passes.
`node --test` over the seventeen files: 223 pass.

## What did not change

Speeds, the hitbox, the pads, the hold times, the floor bands and the 1.0.0 walls
are untouched (`scope-guard.test.mjs` still holds them). The switch deal, the gate
draw, the wolf-mode timers and the online wire are the Build 25 ones; the trap rule
only decides whether the trap pad is drawn at all, and the published `WolfTotal`
is read-only for the blocks that use it.
