# Build 27 — the guest's ice, the waiting clock, the quick door

The morning's list was five things: the movement bug a guest hit in a friend's
room, world quick match, a room that starts itself on a clock and fills the rest
with CPUs, and the two manners items — stamp spam and untrusted data. This build
is all of them. `npm test` runs 239 checks; `tests/pro/v114-build27.test.mjs`
carries the ones that belong to this build, and `v110-online-guest-move.test.mjs`
grew the two that watch a guest's body.

## A. The movement bug (the video)

`ScreenRecording_11-20-2026 21-08-28`, read frame by frame: in たかのり's room
(`DWPLXV`) the guest walks, and about five times a second the ice under it steps
backwards — 6.2px a frame for six frames, then −11px in one, again and again.
That is one correction per 5Hz snapshot.

The cause was Build 24's fix, which was right about the frame and wrong about the
stride. `iceWolfSyncLocal()` moves the guest's own body 32% of the way to the
host's copy of that seat, once per snapshot. The host's copy is *always* behind a
walking phone — one input interval (10Hz, 100ms) plus the host's own 90ms blend,
about a stride — so every snapshot took that stride back. Build 23's leash became
Build 24's sawtooth.

- While this phone drives its own body (the stick, the keys, or a thumb released
  this third of a second) the snapshot may **not** move it at all; only a jump
  past the 260px snap distance (stairs, a warp, a respawn) is taken.
- Standing still, the old 32% is still there, capped at 34px a snapshot so a
  large disagreement is walked in over a few frames instead of jumped.
- `tests/pro/v110-online-guest-move.test.mjs`: *a walking guest is never walked
  backwards by a snapshot* — fails on the old code with 11 backwards frames and a
  worst step of −13.17px (the video's −11px), passes with the fix.

## B. The waiting clock, the door, the CPU fill

1. **A room starts itself.** The host picks **0 / 30 / 60 / 90** seconds on the
   room's rule row (`rule:wait:N`); 0 means the START button only. The countdown
   travels as *seconds left*, never as a timestamp, so two phones with different
   clocks count the same seconds. When it reaches zero the host starts with
   whoever is there.
2. **The empty seats are CPUs.** `iceWolfOnlineSeatCpus()` shows how many the
   start will fill; `iceWolfOnlineStart()` deals them into the same roster the
   round has always had. The lobby line reads
   `あと 12 秒で自動開始（CPU 3体を補完）` in twelve languages.
3. **First come, first seated.** A full room refuses the next phone
   (`online.roomFull`) and a room that filled early starts early. A seat that
   went Out keeps its place inside the thirty second grace.

## C. World quick match

`QUICK MATCH` on the lobby walks six public doors — `MATCH2` … `MATCH7`, codes
the alphabet can hold (no 0/O/1/I) — on the ordinary room wire:

- join the lowest door and wait 1.8 s for a lobby to answer;
- a door that answers with a full or playing room is walked past, not joined;
- a door nobody answers is an empty room, so this phone opens it there with the
  free baseline in every language (seven players, one wolf, five switches, three
  minutes, Classic) and a sixty second clock.

No second channel and no server-side matchmaker: the door is a room code, and the
next phone finds it on the same walk. **Opening** a door is the Pro right CREATE
already is; taking a seat in one is free, exactly as joining a typed code is. A
free player who finds nothing is told so and offered Pro.

## D. Manners

4. **Stamps.** The sender's two second cooldown stays; the receiver now has its
   own rule (`iceWolfStampAccept`): the same sender twice inside 1.5 s is dropped,
   and a muted phone draws nobody's stamp. The mute is one button — in the lobby
   and in the match's stamp bar — kept on the phone (`iceWolfStampMute`).
5. **The gate.** `iceWolfOnlineGuard()` reads every arriving frame as untrusted
   data: a room must describe a room this game could have drawn, a start must
   describe a round it could have dealt, a stamp must be one of the eight, a
   snapshot must be ten bodies with finite positions. Anything else is dropped
   and counted (`OnlineRejectCount`), never drawn and never applied.
6. **A silent seat is played by the CPU.** A phone that has been quiet for three
   seconds (or that the room tick marked Out) hands its body to the CPU on the
   host, so the other players' round keeps moving; the body is the phone's again
   the moment its input is.

## The build

Build 27 went to TestFlight first. The review that followed found one thing
worth a number of its own: a quick walk that was still out when the player left
would open a door behind them, so `leave` (and the end of a round) now stops the
walk, with a test that holds the case. Apple refuses a build number twice, so
the same content ships as **Build 28**, which supersedes Build 27 on
TestFlight. `CURRENT_PROJECT_VERSION = 28` in both configurations and in the
verifier; the GDevelop project stays `1.1.0`.
`python3 scripts/ios/verify-ios-project.py` passes. `node --test` over the
eighteen files: 240 pass.
