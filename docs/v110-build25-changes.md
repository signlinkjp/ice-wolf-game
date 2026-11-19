# Build 25 — the fifteen changes after the long play

An hour and a half on an iPhone, alone, produced fifteen notes: five about the
stages, seven about the rules and the bugs, three about the screen. This build is
all fifteen. `npm test` runs 211 checks; the new file `tests/pro/v112-build25.test.mjs`
carries the ones that belong to this build, and the older files were re-pointed
where a rule changed under them.

## A. The stages

1. **Deep-Sea Aquarium — five giants, two sizes up.** The manta is drawn at twice
   its old size and four more animals join it: a wide crab with raised claws, a
   round-headed octopus over eight arms, a long squid with two whips, and a grey
   shark with one dorsal fin and a crescent tail. One animal crosses each lane per
   beat, picked from `iceWolfSeaPick(seed, beat, lane)` — the round seed the host
   already sends, so both phones watch the same animal at the same second — and the
   beat lasts five seconds instead of three. No hitbox: it passes over the walls.
2. **Misty Park — the coaster.** The speed streaks that were drawn over the arena
   for the whole five seconds are gone (the green speed floor keeps its own), the
   speed is 155% instead of 135%, and the banner reads
   `🎢 ジェットコースターモード！全員スピードUP（あと○秒）` in twelve languages, one
   second at a time.
3. **Misty Park 2F — the maze corner.** The wide empty south-east quarter is a
   maze of eight walls of the sizes the stage already owns (`320x32`, `200x32`,
   `32x130`, `32x108`, `64x64`): in from the north-east gap, round the middle bar,
   out to the west and the south. Three ways in and out and a loop, so nobody is
   run into a single closed dead end; the walk in `v110-stage.test.mjs` still
   reaches every spawn, stair, warp, switch and gate through it.
4. **Snowy Lodge — pillars.** Four more of the stage's own `90x90` pillars on each
   floor, in the open stretches. Same box, same hitbox, same look.
5. **Spaceship — heavy and rocket.** The six random purple cells are gone. The ship
   now runs `12s 通常 → 5s 高重力 (0.55x) → 5s ロケット (1.9x) → 12s 通常 …`, read
   from the match clock, with `🪐 高重力モード あと○秒` / `🚀 ロケットモード あと○秒`
   counted down on the banner and the hull lamps warming and cooling with it. The
   south band stays the low-gravity lane.

## B. The rules and the bugs

6. **A wolf always comes back.** The look is one number (`WolfModeLeft` for the
   player, `AIWolfModeLeft` for a CPU) and it was only ticked down in three narrow
   places: the match flow, the AI block for the seats it drives, and the sync block
   for a phone's own seat. Anything that stepped around one of them kept the number
   positive and the red ears on: a seat the AI skips because a phone owns it, a
   host that went quiet, a wolf frozen by a trap (the AI skips a non-Active body),
   a guest that only copies the host's "mode = 1", a round that ended mid-mode. The
   new `v1.1.0 鬼の状態リセット` block runs last every frame: it stamps the moment a
   mode is armed and closes any mode that outlives its own length by 0.6s, whoever
   forgot to close it, and it strips the mode from a body that is not a wolf or has
   left the round.
7. **One ally per rescue.** The rescue event picked the nearest frozen ally but
   then left `RescueHoldReady` set, so the next frame picked the *next* nearest and
   thawed that one too: two bodies within reach came out together. Each branch now
   empties the gauge and clears the flag after the thaw, so the ring means one
   person, always.
8. **CPU rescue is a hold.** A CPU thawed an ally the frame its body touched the
   ice (34px) while a person had to hold 1.2s. A rescuer now stops beside the ice
   and fills a 1.5s gauge (`ICE_WOLF_CPU_RESCUE`), drains it when the frame goes to
   fleeing or a switch, and still runs from a wolf inside the danger ring.
9. **The CPU wolf recruits.** A CPU wolf that freezes a CPU human turns that
   captive into a second wolf on the spot — the "the wolf is growing" the play
   asked for — once per match, only with three living humans left and never past
   four wolves, and never a phone's own seat. The board (10) says which wolf came
   from where.
10. **The wolf's own board.** A player who is the wolf gets a panel in the top-right
    corner listing every living wolf: 🐺 for the wolf the round opened with, ⚡ for
    one recruited by the trap switch or by an infection, the player marked あなた.
    It is built the first frame the role reads "Wolf" and removed — rows and all —
    for a human, so a human's phone never carries the list. Twelve languages.
11. **A goal after the gate opens.** The AI had no gate code at all: once every
    switch was on, `SwitchIntent` returned null and the humans wandered while the
    clock ran out — the minute the play saw. `__iceWolfV070GateIntent` now reads
    `GateUnlocked` and the open gate's spot, walks the human there (118 speed), rides
    a stair pad when it is on the other floor, and stands down when a wolf is within
    210px so the escape never turns into a suicide run.

## C. The screen

12. **MENU and CAM** moved from the right edge (108px down, where a thumb rests and
    the STATUS line sits) to the free top-right corner; the STATUS line moved under
    them.
13. **The clock** is 58px (was 44), bold, with a thicker outline, in a wider box.
14. **Frozen, the camera goes up.** A frozen player used to follow one CPU down a
    corridor. Now the spectator block raises `SpectatorFrozen`, the ‹ › bar stands
    down, and a third event in the follow group looks at the player from 1500/86 —
    the whole floor in one look, so the ice, the rescuers and the wolf are all on
    screen. A badge reads `❄ 凍結中：俯瞰ビュー` with `救助を待とう（味方と鬼の動きが見える）`
    under it. Thawed, the flag clears and the ordinary camera takes the frame back.
15. **SWITCH ESCAPE explains itself**: a line under the ON/OFF row — `スイッチ脱出：
    ON＝スイッチでゲートを開けて脱出あり／OFF＝時間切れまで逃げ切る氷鬼` — in twelve
    languages.

## The build

`CURRENT_PROJECT_VERSION = 25` in both configurations and in the verifier; the
GDevelop project stays `1.1.0`. `python3 scripts/ios/verify-ios-project.py` passes.
`node --test` over the sixteen files: 211 pass.

## What did not change

Speeds, the hitbox, the pads, the holds, the floor bands and the 1.0.0 walls are
the 1.0.0 numbers (`scope-guard.test.mjs` still holds them); the two new blocks
only read the frame, apart from the wolf mode timers they exist to close. The
online wire is untouched: the stage rules and the recruitment are timed off the
host's clock and seed, which every phone already has.
