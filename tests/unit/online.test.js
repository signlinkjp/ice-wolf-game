/**
 * Online layer: code handling, config, seat order, host election, and the
 * Phoenix frames the game actually sends.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySnapshot,
  assignSeats,
  checkConfig,
  hostCheck,
  makeRoomCode,
  nextHost,
  normalizeCode,
  readOnlineConfig,
  RealtimeTransport,
  snapshotOf,
  socketUrl,
  topicFor,
  validCode,
} from '../../src/online.js';
import { createMatch } from '../../src/core/rules.js';
import { STAGE_BY_ID } from '../../src/data/stages.js';

const baseSettings = { players: 7, wolves: 1, switches: 5, correct: 3, duration: 180 };

test('room codes: six characters, never 0/O/1/I, forgiving input', () => {
  for (let i = 0; i < 200; i += 1) {
    const code = makeRoomCode();
    assert.equal(code.length, 6);
    assert.ok(validCode(code), code);
    assert.ok(!/[01OI]/.test(code), code);
  }
  assert.equal(normalizeCode(' ab-c d '), 'ABCD');
  assert.equal(normalizeCode('oi23jk'), 'QJ23JK');
  assert.equal(validCode('ABC23'), false);
  assert.equal(validCode('ABC23K'), true);
});

test('the channel name and websocket URL match the v1.1.0 room spec', () => {
  assert.equal(topicFor('abc23k'), 'realtime:ice-wolf-room-ABC23K');
  assert.equal(
    socketUrl('https://siivncidktbuyqwsjeqd.supabase.co', 'sb_publishable_x'),
    'wss://siivncidktbuyqwsjeqd.supabase.co/realtime/v1/websocket?apikey=sb_publishable_x&vsn=1.0.0',
  );
});

test('config comes from window first, then localStorage, and secrets are refused', () => {
  const win = {
    ICE_WOLF_ONLINE_CONFIG: { url: 'https://abc.supabase.co', key: 'sb_publishable_1234567890abcdef' },
    localStorage: { getItem: () => JSON.stringify({ url: 'https://local.supabase.co', key: 'k'.repeat(30) }) },
  };
  const cfg = readOnlineConfig(win);
  assert.equal(cfg.url, 'https://abc.supabase.co');
  assert.equal(cfg.source, 'window');
  const local = readOnlineConfig({ localStorage: win.localStorage });
  assert.equal(local.url, 'https://local.supabase.co');
  assert.equal(local.source, 'local');

  assert.equal(checkConfig(null).ok, false);
  assert.equal(checkConfig({ url: 'http://abc.supabase.co', key: 'x'.repeat(30) }).reason, 'online.badUrl');
  assert.equal(checkConfig({ url: 'https://abc.supabase.co', key: 'short' }).reason, 'online.badKey');
  assert.equal(checkConfig({ url: 'https://abc.supabase.co', key: `sb_secret_${'a'.repeat(30)}` }).ok, false);
  assert.equal(checkConfig({ url: 'https://abc.supabase.co', key: `sb_publishable_${'a'.repeat(20)}` }).ok, true);
});

test('the host is seat 0 and the rest join in order', () => {
  const seats = assignSeats(
    [
      { clientId: 'c', name: 'Cara', joinedAt: 30 },
      { clientId: 'h', name: 'Host', joinedAt: 40 },
      { clientId: 'b', name: 'Bo', joinedAt: 20 },
    ],
    'h',
  );
  assert.deepEqual(seats.map((s) => s.clientId), ['h', 'b', 'c']);
  assert.equal(seats[0].host, true);
  assert.equal(seats[1].seat, 1);
  assert.equal(nextHost(seats, 'b'), null, 'only the lowest living seat takes over');
  assert.equal(nextHost([{ ...seats[0], out: true }, seats[1], seats[2]], 'b'), 'b');
});

test('host check: none → takeover → wait → end', () => {
  assert.equal(hostCheck({ hostSeatAlive: true, lastSnapshotAge: 2, secondsLeft: 12, hasNextSeat: true }), 'none');
  assert.equal(hostCheck({ hostSeatAlive: false, lastSnapshotAge: 3, secondsLeft: 12, hasNextSeat: true }), 'takeover');
  assert.equal(hostCheck({ hostSeatAlive: false, lastSnapshotAge: 3, secondsLeft: 12, hasNextSeat: false }), 'wait');
  assert.equal(hostCheck({ hostSeatAlive: false, lastSnapshotAge: 13, secondsLeft: 12, hasNextSeat: false }), 'end');
});

test('a snapshot carries the round and lands on the guest', () => {
  const match = createMatch(STAGE_BY_ID.classic, baseSettings, { seed: 99 });
  match.actors[1].x = 3.5;
  match.actors[1].z = -2.25;
  const snap = snapshotOf(match);
  assert.equal(snap.players.length, 7);
  assert.equal(snap.players[1].x, 3.5);
  assert.equal(snap.switches.length, 5);
  assert.equal(snap.gates.length, 3);

  const guest = createMatch(STAGE_BY_ID.classic, baseSettings, { seed: 5 });
  applySnapshot(guest, snap, { localSeat: 0 });
  assert.ok(Math.abs(guest.actors[1].x - 3.5) < 1e-6);
  assert.equal(guest.timeLeft, snap.timer);
  assert.equal(guest.switches[0].active, snap.switches[0].on);
});

test('the local seat is eased toward the host, not snapped, every snapshot', () => {
  const host = createMatch(STAGE_BY_ID.classic, baseSettings, { seed: 7 });
  const guest = createMatch(STAGE_BY_ID.classic, baseSettings, { seed: 7 });
  host.actors[0].x = 4;
  host.actors[0].z = 0;
  guest.actors[0].x = 0;
  guest.actors[0].z = 0;
  applySnapshot(guest, snapshotOf(host), { localSeat: 0 });
  assert.ok(guest.actors[0].x > 0.9 && guest.actors[0].x < 1.8, `eased to ${guest.actors[0].x}`);
  // A teleport-sized jump is taken as truth.
  host.actors[0].x = -20;
  applySnapshot(guest, snapshotOf(host), { localSeat: 0 });
  assert.equal(guest.actors[0].x, -20);
});

test('the transport joins the room, tracks presence, broadcasts and leaves', async () => {
  const sent = [];
  class FakeWS {
    constructor(url) {
      this.url = url;
      this.readyState = 1;
      FakeWS.instance = this;
      setTimeout(() => this.onopen(), 0);
    }
    send(data) {
      const msg = JSON.parse(data);
      sent.push(msg);
      if (msg.event === 'phx_join') {
        setTimeout(() => this.onmessage({
          data: JSON.stringify({ event: 'phx_reply', payload: { status: 'ok' }, ref: msg.ref }),
        }), 0);
      }
    }
    close() {
      this.readyState = 3;
    }
  }
  const messages = [];
  const transport = new RealtimeTransport({
    url: 'https://abc.supabase.co',
    key: 'sb_publishable_1234567890abcdef',
    code: 'abc23k',
    clientId: 'client-1',
    WebSocketImpl: FakeWS,
    onMessage: (m) => messages.push(m),
  });
  await transport.connect();
  const join = sent.find((m) => m.event === 'phx_join');
  assert.ok(join, 'phx_join sent');
  assert.equal(join.topic, 'realtime:ice-wolf-room-ABC23K');
  assert.equal(join.payload.config.presence.key, 'client-1');
  assert.equal(join.payload.access_token, 'sb_publishable_1234567890abcdef');

  // The server said ok: presence must be tracked immediately.
  const track = sent.find((m) => m.event === 'presence');
  assert.ok(track, 'presence track sent after join (the 2026-11-19 finding)');
  assert.equal(track.payload.event, 'track');

  transport.broadcast('stamp', { stampId: 'help', sender: 'Hana' });
  const stamp = sent.find((m) => m.event === 'broadcast');
  assert.equal(stamp.payload.type, 'broadcast');
  assert.equal(stamp.payload.event, 'stamp');
  assert.deepEqual(stamp.payload.payload, { stampId: 'help', sender: 'Hana' });

  transport.close();
  const untrack = sent.find((m) => m.event === 'presence' && m.payload.event === 'untrack');
  assert.ok(untrack, 'untrack on leave');
  assert.ok(sent.some((m) => m.event === 'phx_leave'));
});
