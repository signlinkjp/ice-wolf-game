# Build 31 — the share button beside the code, and the room that waits for LINE

Two items the player added while Build 30 was being built, on top of the rescue and
frozen-camera work of `docs/v110-build29-changes.md`:

1. **📤 共有** next to the room code (`RLFA9G`), so the code can go to LINE from the
   lobby itself.
2. **The room is still there when the phone comes back.** Switching to LINE and
   back used to leave a dead socket, and a socket that closed during a match ended
   the round on the spot.

`npm test` runs 271 checks (12 new, in `tests/pro/v116-build31.test.mjs`);
`python3 scripts/ios/verify-ios-project.py` passes; the build number is 31 (see
*The build* at the end of `docs/v110-build29-changes.md` for why not 29).

## A. The share button

The room card's code box already had an empty right-hand side, so the button sits
there (`margin-left:auto`, 40px tall, the same blue as the room chrome) and is
shown with the room section — **host and guest alike**, because both of them hold
the code that fills the room.

One tap, and the tap itself does the work (a share sheet opened by a timer is not
opened at all on iOS):

- `navigator.share({ title: 'ICE WOLF', text: '…合言葉: RLFA9G' })` when the
  WebView has it — the system sheet, LINE in the list, and closing the sheet puts
  the lobby back;
- a phone without the Web Share API, or a share that fails for **any reason other
  than the player closing the sheet** (`AbortError`), falls back to
  `navigator.clipboard.writeText(code)`, and the button says `✅ 合言葉をコピーしました`
  for 2.4 seconds;
- a clipboard that is refused or throws says `コピーできませんでした。合言葉を手で伝えてください`.

The invitation line (`online.shareText`), the label (`online.share`) and both
answers are translated into the twelve shipping languages. `OnlineShareState`
carries the last answer for the board and the tests.

`tests/pro/v116-build31.test.mjs` hands a fake navigator to the shipping plan:
the sheet wins, a cancel copies nothing, a real failure copies the code, a phone
with neither says so, and a clipboard that throws is a failure rather than a crash.

## B. The room waits for the phone

The web layer is a WebView: when iOS sends it to the background it closes the
socket, and the phone that comes back has a transport that still says *connected*
while the connection is gone. Build 27's behaviour on that was right for a crash
and wrong for LINE — a closed socket during a match ran `endOnlineRound` on the
frame it arrived.

Build 31 makes the return a first-class path:

- **Wake events.** `visibilitychange` (to visible), `pageshow`, `focus` and the
  network's `online` all mark `online.wakeAt`; the next frame spends it.
- **One rejoin routine.** `attemptRejoin()` closes the socket it has (a socket iOS
  killed still answers `connected`, so it cannot be reused), then asks the
  transport to `join()` **the same room code, client id and seat** it already had.
  It never calls `leave()`: leaving stays the LEAVE button's job.
- **Once a second while off the wire**, and at once on a wake. The result is the
  lobby's own note line: `接続をやり直しています…` while it tries,
  `戻ってきました` when the room answers.
- **A match is paused, not ended.** A close during a live round opens a 30-second
  grace (`ICE_WOLF_RECONNECT.matchGraceMs`) of wall-clock time. Inside it the round
  stays; the guest's host-lost check stands down (the silence is its own), and its
  snapshot clock is refreshed so a returning guest does not accuse the host. Past
  it, `endOnlineRound('online.disconnected')` runs exactly as before. An error from
  the server still ends the round at once — that is not a phone that walked away.
- **A lobby never ends by itself**: its room object is kept across the whole trip,
  so the seats, rules and stage are still on screen when LINE closes.

The pure half (`iceWolfReconnectNeeded`, `iceWolfMatchGraceOpen`) is tested on its
own, and the frame is tested against a stand-in transport: a dead wire asks for
`RLFA9G` / the same client / the same seat, `leave()` is never called, the dead
socket is closed first, a wake event is what starts it, and a match one second into
its loss keeps its room while one past thirty seconds ends on the menu.

## C. What the player should see

1. Create (or join) a room, tap **📤 共有** beside `RLFA9G`.
2. The sheet opens (or the code is copied — a WKWebView without the Web Share API
   takes the copy path); send it to LINE.
3. Come back. The lobby is the room it was, `🙋` stamps and START still work, and
   the note line says `戻ってきました` if the wire had to be remade.

A match survives a short trip the same way: up to 30 seconds away, the round is
still running when the phone returns (the host's snapshots resume on the next
frame); past that the match ends with the reason it always had.
