# Build 29 — the rescue that comes for the phone, and the frozen camera the stick walks

Two asks came with the `ScreenRecording_11-21-2026 01-45-28` recording (58 seconds
of the yard, 10 players, 3:00):

1. *"🆘 came up, but a minute went by and nobody came for me — the CPUs should try
   to rescue the user."*
2. *"The overhead view while frozen is a big win — can the stick move the camera
   while I wait, so I can watch everyone?"*

Both are in this build. `npm test` runs 259 checks (19 of them new, in
`tests/pro/v115-build29.test.mjs`); `python3 scripts/ios/verify-ios-project.py`
passes; the content ships as **Build 31** (`CURRENT_PROJECT_VERSION = 31` in both
configurations and in the verifier — see *The build* below for why it is not 29);
the GDevelop project stays `1.1.0`.

The recording itself is a match where the ice did its job: at 2:26 the board read
`生存 1 / 凍結 6` — six of the seven humans were already on the ice — and the one
CPU still standing never arrived. That is the state Build 25's rescue could not
leave: its search radius was 520px, it always picked the *nearest* ice (never the
phone), and a wolf in WOLF MODE within 360px of the ice made it give up the entire
errand and walk to a switch instead.

## A. The rescue plan (the CPU's hands, Build 29)

`game.json` → `v0.6.1 Human CPU Navigation Recovery + CPU Wolf Cycle` grows one
testable block (`/* ==== v1.1.0 build 29 rescue plan … */`) and the pass that walks
the humans now *reads* a plan built once per frame instead of choosing per CPU:

| rule | value | why |
| --- | --- | --- |
| the frozen phone | always a target, either floor, **any distance** | a player alone at the far end of 1F was never even a candidate before |
| CPUs on the phone | 1 first, a 2nd only if the floor has one to spare | so one being chased or riding the stairs cannot leave nobody coming |
| CPUs on any other ice | 2 | four frozen allies used to pull the whole floor off the switches |
| walk for a teammate | 1150px (one floor across) | a rescue across the room is worth the walk, across the map is not |
| a CPU riding for a switch | picked last (+520) | switches keep working while the ice is answered |
| a CPU a wolf is chasing | later still (+420) | it has its own problem |
| a rescuer already walking | keeps its claim (−300) | no frame-by-frame swapping between two bodies |
| a wolf in WOLF MODE **on** the ice | the rescuer holds at 390px and goes in when the mode drops | Build 25 gave up at 360px — that is the minute the player watched |

The hold is a real behaviour change, not a number: the rescuer walks toward the
ice until it is at the ring (390px from the wolf, inside 520px of the ice), stands
there — visible to the frozen player, who can now watch it wait — and the moment
the five-second mode ends it closes the last few metres and fills the 1.5s gauge.
Both stair slots busy is a wait at the pad, not a walk to a switch.

Two scene variables are published for the board and the tests: `ActorRescuePlanCount`
(claims this frame) and `ActorRescuePlayerCount` (CPUs on the phone's ice).

What the tests hold:

- *the frozen phone is answered first, even from the far end of the floor* — the
  phone takes the nearest CPU at 1100px although an ally is 60px from it;
- *the phone keeps its second CPU only when nobody else needs one* — an ally being
  worked is never stripped of its rescuer, and five free CPUs never put more than
  two on one block of ice;
- *a teammate is worth a walk across the floor, and no further* (1150 in, 1200 out);
- *four frozen allies and eight CPUs: two each*;
- live, against a stand-in scene: *the frozen phone at the far end of 1F is walked
  to and thawed* (≈1100 frames of walking and holding), *one CPU, an ally on its
  doorstep and a frozen phone: the phone wins*, *two CPUs: the phone and the ally
  are both thawed, the ally first*, and *a wolf in WOLF MODE over the ice: the
  rescuer waits at the ring and goes in after*.

## B. The stick moves the frozen camera

While the player is frozen the camera has been 1500 up at 86° over the block of
ice since Build 25. It is now a **position** (`ThirdPersonCamera::LookFromDistanceAtPosition3D`)
instead of an object, and the stick moves that position:

- `MoveX` / `MoveY` are already written every frame by the joystick block and the
  arrow keys / WASD — the same input the body refuses while it is frozen, so
  nothing new is read from the screen;
- the look point walks at 620px/s, clamped to `x −648 … 2232`, `y −648 … 632`
  (both floors less a wall's width), so the camera cannot leave the stage;
- the camera eases after the look point at 9/s, so a step of the thumb is a glide
  and letting go settles where the stick left it;
- the height is the body's Z plus half its depth (16 on the 17×17×32 player), which
  is exactly what the object look used, so freeze-in is seamless;
- thawed, or the round over, the pan closes and the chase camera has the player
  back on the next frame;
- the frozen badge gains a third line, `🕹️ スティックでカメラ移動`, in all twelve
  languages (`frozen.pan`).

Scene variables: `SpectatorPanActive`, `SpectatorPanMoved`, `SpectatorPanX/Y/Z`.
The frozen view also keeps the camera when there is nobody left to follow
(`SpectatorActive` used to switch it off with no living candidate, which is exactly
the 生存 1 case in the recording).

## The build

Build 29 went to TestFlight first, and the bundle it produced was read back before
anyone played it: the frozen camera's three expressions had been written as
`GlobalVariable(SpectatorPanX)`, which the exporter compiles to
`runtimeScene.getGame().getVariables().get("SpectatorPanX")` — the **game**
variables, where nothing of that name exists, so `getAsNumber()` of `undefined`
would throw on every frozen frame. The pan block writes **scene** variables, and a
bare name (like `MoveX` in the shipped walk) compiles to
`runtimeScene.getScene().getVariables().getFromIndex(n)`, the container the block
writes. A test now pins the frozen camera to bare scene names and fails on
`GlobalVariable(`.

The content therefore ships as **Build 31**: 29 was the broken upload, 30 was
cancelled mid-upload for the two items the player added while it ran
(`docs/v110-build31-changes.md` — the share button and the room that survives a
trip to LINE), and 31 carries all of it. `CURRENT_PROJECT_VERSION = 31` in both
configurations and in the verifier, the GDevelop project still `1.1.0`.

`npm test` is 271 pass; `python3 scripts/ios/verify-ios-project.py` passes; the
exported `code1.js` of the shipped build reads
`runtimeScene.getScene().getVariables().getFromIndex(...)` for all three pan values.
