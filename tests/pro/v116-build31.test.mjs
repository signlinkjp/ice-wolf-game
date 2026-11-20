// Build 31 — the share button beside the room code, and the room that is still
// there when the phone comes back from LINE.
//
// The player's ask beside the 01:45 recording: put 📤 共有 next to `RLFA9G`,
// send it to LINE, and come back to the same room instead of a dead one.
//
//   * the share itself is a pure plan over a navigator: system sheet, clipboard,
//     a sheet the player closed (not a failure), and the one-way label it says;
//   * the lobby's code box carries the button, host and guest alike, in twelve
//     languages;
//   * the rejoin is a decision (pure) and a frame (live, against a stand-in
//     transport): the same code, no leave(), and a match that waits instead of
//     ending on the frame the socket closed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import { repoRoot, readGame, sceneOf, groupCode, createI18n, LANGS, KANA } from './helpers.mjs';

const LOBBY_GROUP = 'v1.1.0 オンラインロビー';
const CORE_GROUP = 'v1.1.0 オンライン中核';

const blockOf = (controller, open, close, names) => {
  const list = Array.isArray(names) ? names : String(names).split(',').map((name) => name.trim());
  const code = groupCode(controller);
  const from = code.indexOf(open);
  const to = code.indexOf(close);
  if (from < 0 || to < 0) throw new Error(`markers missing in ${controller}: ${open}`);
  const context = vm.createContext({ Math, Number, String, Array, Object, Map, Set, Promise, console });
  vm.runInContext(`${code.slice(from, to)}\n;globalThis.__block = { ${list.join(', ')} };`, context,
    { filename: `game.json#${open}` });
  return context.__block;
};

/* ---------------------------------------------------------------- the share */
const share = blockOf(LOBBY_GROUP, '/* ==== v1.1.0 build 31 share',
  '/* ==== end v1.1.0 build 31 share ==== */',
  'ICE_WOLF_SHARE_TITLE, iceWolfSharePlan, iceWolfShareRoom, iceWolfCopyRoom');

test('the share prefers the system sheet, and copies the code when there is none', () => {
  assert.equal(share.ICE_WOLF_SHARE_TITLE, 'ICE WOLF');
  const sheet = { share: () => Promise.resolve() };
  assert.equal(share.iceWolfSharePlan(sheet, 'RLFA9G', 'text', 'ICE WOLF').kind, 'share');
  const clipboard = { clipboard: { writeText: () => Promise.resolve() } };
  assert.equal(share.iceWolfSharePlan(clipboard, 'RLFA9G', 'text', 'ICE WOLF').kind, 'clipboard');
  assert.equal(share.iceWolfSharePlan(null, 'RLFA9G', 'text', 'ICE WOLF').kind, 'none');
  assert.equal(share.iceWolfSharePlan(sheet, '', 'text', 'ICE WOLF').kind, 'none', 'no code, nothing to share');
  const planned = share.iceWolfSharePlan(sheet, 'RLFA9G', 'Play ICE WOLF with me! Room code: RLFA9G', 'ICE WOLF');
  assert.equal(planned.title, 'ICE WOLF');
  assert.match(planned.text, /RLFA9G/, 'the invitation carries the code');
});

test('the system sheet gets the invitation, and only a real failure falls back', async () => {
  const calls = [];
  const nav = {
    share: (payload) => { calls.push(payload); return Promise.resolve(); },
    clipboard: { writeText: (value) => { calls.push({ copied: value }); return Promise.resolve(); } }
  };
  const said = [];
  assert.equal(share.iceWolfShareRoom(nav, 'RLFA9G', 'Play ICE WOLF with me! Room code: RLFA9G', 'ICE WOLF',
    (state) => said.push(state)), 'shared');
  assert.equal(calls[0].title, 'ICE WOLF');
  assert.equal(calls[0].text, 'Play ICE WOLF with me! Room code: RLFA9G');
  assert.equal(calls.length, 1, 'a sheet that opened is not copied over');
  /* The player closed the sheet: nothing copied, nothing said. */
  const abort = { share: () => Promise.reject(Object.assign(new Error('cancel'), { name: 'AbortError' })) };
  const quiet = [];
  share.iceWolfShareRoom(abort, 'RLFA9G', 'text', 'ICE WOLF', (state) => quiet.push(state));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(quiet, ['shared', 'cancelled'], 'a cancel says so and stops');
  /* Any other failure is worth the clipboard. */
  const broken = {
    share: () => Promise.reject(new Error('not allowed')),
    clipboard: { writeText: (value) => { quiet.push('copied:' + value); return Promise.resolve(); } }
  };
  share.iceWolfShareRoom(broken, 'RLFA9G', 'text', 'ICE WOLF', (state) => quiet.push(state));
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(quiet.includes('copied:RLFA9G'), 'the code is copied instead');
  assert.ok(quiet.includes('copied'), 'and the button says so');
  /* A phone with neither: it says it could not, in the player's language. */
  const none = [];
  assert.equal(share.iceWolfShareRoom(null, 'RLFA9G', 'text', 'ICE WOLF', (state) => none.push(state)), 'failed');
  assert.deepEqual(none, ['failed']);
});

test('the copy path answers, and a clipboard that throws is a failure, not a crash', async () => {
  const said = [];
  const nav = { clipboard: { writeText: () => Promise.resolve() } };
  assert.equal(share.iceWolfCopyRoom(nav, 'RLFA9G', (state) => said.push(state)), 'copying');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(said, ['copied']);
  const rejected = { clipboard: { writeText: () => Promise.reject(new Error('denied')) } };
  const failed = [];
  share.iceWolfCopyRoom(rejected, 'RLFA9G', (state) => failed.push(state));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(failed, ['failed']);
  const throwing = { clipboard: { writeText: () => { throw new Error('nope'); } } };
  const threw = [];
  assert.equal(share.iceWolfCopyRoom(throwing, 'RLFA9G', (state) => threw.push(state)), 'failed');
  assert.deepEqual(threw, ['failed']);
});

test('the button sits in the code box, for the host and the guest alike', () => {
  const lobby = groupCode(LOBBY_GROUP);
  const box = lobby.slice(lobby.indexOf('class="iwo-codebox"'));
  assert.ok(box.slice(0, 400).includes('data-online-share'), 'the button is inside the code box');
  assert.ok(box.slice(0, 400).includes('data-online-roomcode'), 'beside the code itself');
  assert.ok(lobby.includes(".iwo-share{margin-left:auto"), 'and takes the empty space on the right');
  assert.ok(lobby.includes("share: pick('[data-online-share]')"), 'the sheet keeps the node');
  assert.ok(lobby.includes("iceWolfShareRoom(typeof navigator !== 'undefined' ? navigator : null, code,"),
    'a tap shares this room code');
  assert.ok(lobby.includes("onlineTr('online.shareText', { code: code })"), 'with the invitation line');
  assert.ok(lobby.includes("onlineUiVars.get('OnlineShareState').setString"), 'and reports what happened');
  /* The room section is the one with the code in it, and it is shown whenever a
   * room stands — hosting or not. */
  assert.ok(lobby.includes('show(nodes.roomSection, inRoom);'), 'the code card is shown in a room');
  assert.ok(lobby.includes('setText(nodes.roomCode, state.room.code);'), 'with the code the room has');
});

/* -------------------------------------------------------------- the rejoin */
const rejoin = blockOf(CORE_GROUP, '/* ==== v1.1.0 build 31 reconnect',
  '/* ==== end v1.1.0 build 31 reconnect ==== */',
  'ICE_WOLF_RECONNECT, iceWolfReconnectNeeded, iceWolfMatchGraceOpen');

test('a phone in a room that is off the wire is a phone that tries again', () => {
  const room = { code: 'RLFA9G', status: 'lobby' };
  const dead = { connected: false, joined: false };
  assert.equal(rejoin.iceWolfReconnectNeeded(dead, room, false, 0, 1000), true, 'a dead wire is a rejoin');
  assert.equal(rejoin.iceWolfReconnectNeeded({ connected: true, joined: false }, room, false, 0, 1000), true,
    'a socket without the room is one too');
  assert.equal(rejoin.iceWolfReconnectNeeded({ connected: true, joined: true }, room, false, 0, 1000), false,
    'a phone already in the room asks for nothing');
  assert.equal(rejoin.iceWolfReconnectNeeded(dead, null, false, 0, 1000), false, 'no room, nothing to rejoin');
  assert.equal(rejoin.iceWolfReconnectNeeded(dead, room, true, 0, 1000), false,
    'the practice hub has no wire to lose');
  assert.equal(rejoin.iceWolfReconnectNeeded(dead, room, false, 1000, 2000), false,
    'a join that is still out is left alone');
  assert.equal(rejoin.iceWolfReconnectNeeded(dead, room, false, 1000, 8000), true,
    'and one that never answered is retried');
  assert.equal(rejoin.ICE_WOLF_RECONNECT.retryMs > 0, true, 'the retry has a pace');
  assert.equal(rejoin.ICE_WOLF_RECONNECT.matchGraceMs >= 20000, true, 'a match waits long enough for LINE');
});

test('a live match waits for the wire, then ends the way it always did', () => {
  assert.equal(rejoin.iceWolfMatchGraceOpen(0, 1000), false, 'no loss, no grace');
  assert.equal(rejoin.iceWolfMatchGraceOpen(1000, 2000), true, 'two seconds in, the round waits');
  assert.equal(rejoin.iceWolfMatchGraceOpen(1000, 1000 + rejoin.ICE_WOLF_RECONNECT.matchGraceMs), false,
    'past the grace it is over');
  assert.equal(rejoin.iceWolfMatchGraceOpen(1000, 2000, { matchGraceMs: 1500 }), true,
    'a second in is inside a 1.5 second grace');
  assert.equal(rejoin.iceWolfMatchGraceOpen(1000, 2000, { matchGraceMs: 900 }), false,
    'and outside a 0.9 second one');
});

/* The frame itself, against a stand-in transports: the room survives a socket
 * that closed, the rejoin asks for the same code, and nothing leaves. */
const variableBag = (entries = {}) => {
  const values = new Map(Object.entries(entries));
  return {
    values,
    get: (name) => ({
      getAsString: () => String(values.get(name) ?? ''),
      setString: (value) => { values.set(name, String(value)); },
      getAsNumber: () => Number(values.get(name) ?? 0),
      setNumber: (value) => { values.set(name, Number(value)); },
      getAsBoolean: () => values.get(name) === true,
      setBoolean: (value) => { values.set(name, value === true); }
    })
  };
};

const makeCoreScene = (vars = {}) => {
  const sceneVars = variableBag({ RoundPhase: 'Menu', ...vars });
  const listeners = {};
  const window = {
    addEventListener: (type, handler) => { (listeners[type] = listeners[type] || []).push(handler); },
    ICE_WOLF_ONLINE_CONFIG: { url: 'https://demo.supabase.co', key: 'anonpublickeyanonpublickey' }
  };
  const document = {
    hidden: false,
    addEventListener: (type, handler) => { (listeners[type] = listeners[type] || []).push(handler); }
  };
  const runtimeScene = {
    getVariables: () => sceneVars,
    getObjects: () => [],
    getGame: () => ({ getAssetPath: () => '' })
  };
  const context = vm.createContext({
    runtimeScene, window, document, console,
    localStorage: { getItem: () => null, setItem: () => {} },
    navigator: { languages: ['ja'], language: 'ja' },
    Math, Number, String, Array, Object, Map, Set, Promise, Date, JSON
  });
  vm.runInContext(`globalThis.__onlineFrame = function () {\n${groupCode(CORE_GROUP)}\n};`, context,
    { filename: 'game.json#v1.1.0 オンライン中核' });
  const fire = (type) => {
    for (const handler of listeners[type] || []) handler({ type });
  };
  return {
    runtimeScene, sceneVars, context, listeners, fire, document, window,
    frame: () => vm.runInContext('__onlineFrame()', context),
    state: () => runtimeScene.__iceWolfV110Online
  };
};

const stubTransport = (status) => {
  const calls = { join: [], leave: 0, disconnect: 0, send: [] };
  return {
    calls,
    on: () => {},
    status: () => status,
    presence: () => [],
    pump: () => 0,
    send: (message) => { calls.send.push(message); return true; },
    join: (request) => { calls.join.push(request); return Promise.resolve({ ok: true }); },
    leave: () => { calls.leave += 1; return Promise.resolve({ ok: true }); },
    disconnect: () => { calls.disconnect += 1; return Promise.resolve({ ok: true }); }
  };
};

const ROOM = {
  code: 'RLFA9G',
  hostId: 'host-1',
  hostName: 'Hana',
  stageId: 'classic',
  status: 'lobby',
  quick: false,
  rules: { playerCount: 7, wolfCount: 1, switchCount: 5, correctCount: 3, matchSeconds: 180, waitSeconds: 0 },
  correctCount: 3,
  pro: true,
  seats: [{ seat: 0, clientId: 'host-1', name: 'Hana', ready: true, cpu: false, out: false, joinedAt: 0, lastSeen: 0, role: '' },
    { seat: 1, clientId: 'me-1', name: 'Me', ready: false, cpu: false, out: false, joinedAt: 0, lastSeen: 0, role: '' }],
  seed: 42,
  createdAt: 0,
  startedAt: 0,
  result: '',
  revision: 3
};

test('a socket that closed leaves the room standing, and the wake puts it back', () => {
  const scene = makeCoreScene();
  scene.frame();
  const online = scene.state();
  assert.ok(online, 'the core published its state');
  online.clientId = 'me-1';
  online.name = 'Me';
  online.seat = 1;
  online.local = false;
  online.isHost = false;
  online.room = JSON.parse(JSON.stringify(ROOM));
  online.mode = 'guest';
  const transport = stubTransport({ connected: false, joined: false });
  online.transport = transport;
  scene.frame();
  assert.equal(transport.calls.join.length, 1, 'the frame asked the room for the seat again');
  assert.equal(transport.calls.join[0].code, 'RLFA9G', 'on the same code');
  assert.equal(transport.calls.join[0].clientId, 'me-1', 'as the same phone');
  assert.equal(transport.calls.join[0].seat, 1, 'on the same seat');
  assert.equal(transport.calls.leave, 0, 'and never left the room');
  assert.equal(transport.calls.disconnect, 1, 'the dead socket was closed first');
  assert.ok(online.room && online.room.code === 'RLFA9G', 'the room is still this phone’s');
  assert.equal(scene.sceneVars.get('OnlineReconnectCount').getAsNumber(), 1);
});

test('the wake events are the ones a phone back from LINE actually fires', () => {
  const scene = makeCoreScene();
  scene.frame();
  for (const type of ['visibilitychange', 'pageshow', 'focus', 'online']) {
    assert.ok((scene.listeners[type] || []).length > 0, `${type} is listened for`);
  }
  const online = scene.state();
  online.local = false;
  online.room = JSON.parse(JSON.stringify(ROOM));
  const transport = stubTransport({ connected: true, joined: true });
  online.transport = transport;
  scene.frame();
  assert.equal(transport.calls.join.length, 0, 'a phone already in the room is left alone');
  const frameWithWake = (target) => { target.frame(); };
  /* The screen goes away, then comes back. */
  scene.document.hidden = true;
  scene.fire('visibilitychange');
  assert.equal(scene.sceneVars.get('OnlineWakeCount').getAsNumber(), 0, 'going away is not a wake');
  scene.document.hidden = false;
  scene.fire('visibilitychange');
  assert.equal(scene.sceneVars.get('OnlineWakeCount').getAsNumber(), 1, 'coming back is');
  scene.fire('pageshow');
  assert.equal(scene.sceneVars.get('OnlineWakeCount').getAsNumber(), 2, 'and so is a restored page');
  frameWithWake(scene);
  assert.equal(transport.calls.join.length, 0, 'a phone already in the room is left alone');
  assert.equal(online.wakeAt, 0, 'the wake is spent on the frame that read it');
});

test('a match whose wire died is paused for the grace, then ended', () => {
  const scene = makeCoreScene({ RoundPhase: 'Active' });
  scene.frame();
  const online = scene.state();
  online.clientId = 'me-1';
  online.name = 'Me';
  online.seat = 1;
  online.local = false;
  online.isHost = false;
  online.room = Object.assign(JSON.parse(JSON.stringify(ROOM)), { status: 'playing' });
  online.payload = { kind: 'start', roster: [] };
  online.mode = 'guest';
  const transport = stubTransport({ connected: true, joined: true });
  online.transport = transport;
  online.lastSnapshotRxAt = Date.now();
  online.wireLostAt = Date.now() - 1000;
  scene.frame();
  assert.ok(online.room && online.room.code === 'RLFA9G', 'inside the grace the round waits for LINE');
  assert.notEqual(scene.sceneVars.get('RoundCommand').getAsString(), 'Menu', 'and the player is not thrown out');
  online.wireLostAt = Date.now() - 31000;
  scene.frame();
  assert.equal(online.room, null, 'past the grace the match ends as it always did');
  assert.equal(scene.sceneVars.get('RoundCommand').getAsString(), 'Menu', 'on the menu, with the reason');
  assert.equal(scene.sceneVars.get('OnlineRoomActive').getAsBoolean(), false);
});

test('the rejoin is wired where the wire is, and nowhere leaves the room', () => {
  const code = groupCode(CORE_GROUP);
  assert.ok(code.includes("document.addEventListener('visibilitychange'"), 'the screen coming back is read');
  assert.ok(code.includes("window.addEventListener('pageshow'"), 'so is a restored page');
  assert.ok(code.includes("window.addEventListener('focus'"), 'and the window focus');
  assert.ok(code.includes("window.addEventListener('online'"), 'and the network coming back');
  assert.ok(code.includes('const attemptRejoin = (reason) => {'), 'one rejoin routine');
  assert.ok(code.includes("if (typeof transport.disconnect === 'function') transport.disconnect();"),
    'the dead socket is closed before the new one');
  assert.ok(code.includes("setNote('online.reconnecting')"), 'the lobby says it is trying');
  assert.ok(code.includes("setNote('online.reconnected')"), 'and says when it is back');
  const attempt = code.slice(code.indexOf('const attemptRejoin = (reason) => {'),
    code.indexOf('const broadcastRoom = () => {'));
  assert.equal(attempt.includes('.leave('), false, 'a rejoin never leaves the room');
  assert.ok(attempt.includes('online.room.code'), 'it asks for the room this phone is in');
  assert.ok(code.includes('if (online.wireLostAt && !iceWolfMatchGraceOpen(online.wireLostAt, wireAt))'),
    'the grace decides when a paused match is over');
  assert.ok(code.includes('&& !online.wireLostAt) {'), 'a phone off the wire does not call the host lost');
  for (const name of ['OnlineReconnectCount', 'OnlineWakeCount', 'OnlineShareState']) {
    assert.ok(sceneOf(readGame()).variables.some((variable) => variable.name === name), `${name} is published`);
  }
});

test('the share and rejoin lines are in twelve languages, and only Japanese has kana', () => {
  const { i18n } = createI18n();
  const keys = ['online.share', 'online.shareText', 'online.shareCopied', 'online.shareFailed', 'online.reconnecting'];
  for (const key of keys) {
    for (const lang of LANGS) {
      i18n.setLang(lang);
      const line = i18n.t(key, { code: 'RLFA9G' });
      assert.ok(line.length > 0, `${key} [${lang}] is empty`);
      if (lang !== 'ja') assert.equal(KANA.test(line), false, `${key} [${lang}] carries Japanese kana: ${line}`);
    }
  }
  i18n.setLang('ja');
  assert.match(i18n.t('online.share'), /共有/);
  assert.match(i18n.t('online.shareText', { code: 'RLFA9G' }), /RLFA9G/);
  const english = createI18n().i18n;
  english.setLang('en');
  assert.match(english.t('online.shareText', { code: 'RLFA9G' }), /RLFA9G/, 'the invitation carries the code');
});

/* ------------------------------------------------------------------ the build */
test('the build is 1.1.0 (31) on every side, and npm test runs this file', () => {
  const pbx = fs.readFileSync(path.join(repoRoot, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  const builds = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((match) => match[1]);
  assert.deepEqual(builds, ['31', '31'], 'both configurations carry Build 31');
  const verify = fs.readFileSync(path.join(repoRoot, 'scripts/ios/verify-ios-project.py'), 'utf8');
  assert.ok(verify.includes('DEFAULT_BUILD_NUMBER = "31"'), 'the verifier builds 31');
  assert.equal(readGame().properties.version, '1.1.0', 'the GDevelop project stays 1.1.0');
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts.test.includes('v116-build31.test.mjs'), 'npm test runs this file');
});
