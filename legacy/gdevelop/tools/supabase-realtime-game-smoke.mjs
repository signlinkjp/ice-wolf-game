#!/usr/bin/env node
// Two-phone live test of the shipping ICE WOLF Realtime transport.
//
// Pulls the `v1.1.0 online core` block straight out of game.json (the same code
// the app runs), hands it the real browser WebSocket, and has two clients join
// one room topic on the real Supabase project: presence must see both, and a
// stamp broadcast must cross from one to the other. This is the path the phones
// take in Phase 2 (Broadcast + Presence only, no tables, no RLS).
//
// Usage:
//   node --experimental-websocket tools/supabase-realtime-game-smoke.mjs \
//     --url https://PROJECT.supabase.co --key sb_publishable_xxx [--code TEST42]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index].replace(/^--/, ''), process.argv[index + 1]);
}
const url = (args.get('url') || '').replace(/\/+$/, '');
const key = args.get('key') || '';
const code = (args.get('code') || 'TEST42').toUpperCase();
if (!url || !key) {
  console.error('usage: node --experimental-websocket tools/supabase-realtime-game-smoke.mjs --url https://PROJECT.supabase.co --key KEY [--code TEST42]');
  process.exit(3);
}
if (typeof WebSocket === 'undefined') {
  console.error('no global WebSocket: run node with --experimental-websocket');
  process.exit(3);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const game = JSON.parse(fs.readFileSync(path.join(repoRoot, 'game.json'), 'utf8'));
const scene = game.layouts.find((layout) => layout.name === 'FROST LAB');
const group = scene.events.find((event) => event.name === 'v1.1.0 オンライン中核');
const groupCode = (Array.isArray(group.events[0].inlineCode) ? group.events[0].inlineCode.join('\n') : group.events[0].inlineCode || '');
const start = groupCode.indexOf('/* ==== v1.1.0 online core');
const end = groupCode.indexOf('/* ==== end v1.1.0 online core ==== */');
if (start < 0 || end < 0) throw new Error('the online core markers are missing');
const core = groupCode.slice(start, end);

const context = vm.createContext({ console, WebSocket, Date, Math, JSON, Promise, Set, Number, String, Array, Object, isFinite, encodeURIComponent, setTimeout, clearTimeout });
vm.runInContext(`${core}\n;globalThis.__online = { iceWolfOnlineConfig, iceWolfOnlineSocketUrl, iceWolfOnlineTopic, createIceWolfSupabaseTransport, iceWolfOnlineNewRoom, iceWolfOnlineJoinRoom, iceWolfOnlineTick, iceWolfOnlineStart, iceWolfOnlineSnapshot, iceWolfOnlineInput, iceWolfOnlineSeatOf, iceWolfStampMessage, ICE_WOLF_STAMPS };`, context, { filename: 'game.json#v1.1.0 online core' });
const online = context.__online;

const config = online.iceWolfOnlineConfig({ url, key });
console.log('config:', { configured: config.configured, host: config.host, reason: config.reason });
if (!config.configured) process.exit(2);
console.log('socket url:', online.iceWolfOnlineSocketUrl(config).replace(/apikey=[^&]+/, 'apikey=<redacted>'));
console.log('topic:', online.iceWolfOnlineTopic(code));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const host = online.createIceWolfSupabaseTransport({ config, WebSocket, clientId: 'smoke-host', name: 'Host', now: () => Date.now() });
const guest = online.createIceWolfSupabaseTransport({ config, WebSocket, clientId: 'smoke-guest', name: 'Guest', now: () => Date.now() });
const hostEvents = [];
const guestEvents = [];
host.on((event) => hostEvents.push(event));
guest.on((event) => guestEvents.push(event));

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

try {
  const hostConnect = await host.connect({ clientId: 'smoke-host', name: 'Host' });
  check('host socket opens', hostConnect.ok === true, JSON.stringify(hostConnect));
  const guestConnect = await guest.connect({ clientId: 'smoke-guest', name: 'Guest' });
  check('guest socket opens', guestConnect.ok === true, JSON.stringify(guestConnect));

  const hostJoin = await host.join({ code, clientId: 'smoke-host', name: 'Host', seat: 0 });
  check(`host joins realtime:ice-wolf-room-${code}`, hostJoin.ok === true, JSON.stringify(hostJoin).slice(0, 200));
  const guestJoin = await guest.join({ code, clientId: 'smoke-guest', name: 'Guest', seat: 1 });
  check('guest joins the same room', guestJoin.ok === true, JSON.stringify(guestJoin).slice(0, 200));

  /* Presence: both client ids on both phones. */
  await sleep(1500);
  const hostSees = host.presence().map((member) => member.clientId).sort();
  const guestSees = guest.presence().map((member) => member.clientId).sort();
  check('host presence lists both phones', hostSees.includes('smoke-host') && hostSees.includes('smoke-guest'), JSON.stringify(hostSees));
  check('guest presence lists both phones', guestSees.includes('smoke-host') && guestSees.includes('smoke-guest'), JSON.stringify(guestSees));

  /* A stamp crosses; only the id travels and the receiver gets it. */
  const sent = guest.send(online.iceWolfStampMessage('help', 'Guest', Date.now()));
  check('guest sends a stamp frame', sent === true);
  await sleep(1200);
  const stamp = hostEvents.filter((event) => event.kind === 'stamp').pop();
  check('host receives the stamp id', !!stamp && stamp.stampId === 'help' && stamp.sender === 'Guest', JSON.stringify(stamp || null));

  /* A guest input reaches the host on the same wire. */
  guest.send(online.iceWolfOnlineInput(1, 1, -1, 'none'));
  await sleep(1000);
  const input = hostEvents.filter((event) => event.kind === 'input').pop();
  check('host receives a 10Hz input', !!input && input.from === 'smoke-guest', JSON.stringify(input || null));

  /* A host snapshot reaches the guest. */
  host.send(online.iceWolfOnlineSnapshot({ t: Date.now(), phase: 'Active', timer: 180, players: [{ id: 'YOU', x: 0, y: 0, z: 0 }] }));
  await sleep(1000);
  const snapshot = guestEvents.filter((event) => event.kind === 'snapshot').pop();
  check('guest receives a host snapshot', !!snapshot && snapshot.players.length === 1, JSON.stringify(snapshot || null).slice(0, 160));

  /* Leaving says goodbye on the wire. */
  host.leave();
  guest.leave();
  await sleep(400);
  check('both leave cleanly', host.status().joined === false && guest.status().joined === false);
} catch (error) {
  check('no exception', false, String(error && error.stack || error));
} finally {
  host.disconnect();
  guest.disconnect();
}

const failed = results.filter((row) => !row.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
