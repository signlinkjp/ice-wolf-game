// Build 23: the ONLINE button on the title screen, pressed for real.
//
// The report from the phone was one line — "オンライン押しても反応無し" — and it
// was true of the whole sheet, not only of the button: the lobby was built,
// filled and left at the stylesheet's `display:none`, because the update pass
// showed the element only `if (nodes.root)`, a key the node map never had. The
// state variables said the lobby was open the whole time, which is why the
// per-variable checks in v110-online.test.mjs were happy.
//
// So this file presses the button instead of reading a variable:
//
//   * it runs the shipping title-screen block, takes the element that carries
//     `data-action="online"`, and calls its own pointerdown handler;
//   * it runs the shipping lobby block for a frame;
//   * and it looks at the element the lobby appended to the page — its
//     `display`, its `iwo-show` class and its text — the way a phone would.
//
// The document here is a small stand-in that keeps the elements it creates and
// hands the same element back for the same selector, so "the sheet the lobby
// built" and "the sheet on the screen" are the same object, as they are in a
// browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

import { groupCode, readGame } from './helpers.mjs';

const I18N_GROUP = 'v1.0.0 12言語 i18n';
const MENU_GROUP = 'v0.6.5 Production Round Start + Main Menu';
const ONLINE_GROUP = 'v1.1.0 オンライン中核';
const LOBBY_GROUP = 'v1.1.0 オンラインロビー';
const STAMP_GROUP = 'v1.1.0 クイックスタンプ';

const attributesIn = (html) => {
  const found = new Map();
  const pattern = /data-([a-z0-9-]+)(?:="([^"]*)")?/g;
  let match = pattern.exec(String(html || ''));
  while (match) {
    const name = 'data-' + match[1];
    if (!found.has(name)) found.set(name, []);
    found.get(name).push(match[2] === undefined ? '' : match[2]);
    match = pattern.exec(String(html || ''));
  }
  return found;
};

/* One stand-in element. The selectors the two shipping blocks use are answered
 * from the template the element was given, and the same selector returns the
 * same child every time (a button is one button, however often it is found). */
/* A clock the harness can step: Build 33 ignores a second tap of the same action
 * inside 500ms, and two taps in a test are two gestures, not one. */
let clock = 1_800_000_000_000;
class TestDate extends Date {
  static now() { return clock; }
}

const makeElement = (tagName = 'div') => {
  const element = {
    tagName: String(tagName).toUpperCase(),
    _html: '',
    _children: [],
    _bySelector: new Map(),
    _handlers: new Map(),
    children: [],
    attributes: {},
    style: {},
    dataset: {},
    textContent: '',
    value: '',
    disabled: false,
    className: '',
    classList: {
      _set: new Set(),
      add(name) { this._set.add(name); },
      remove(name) { this._set.delete(name); },
      toggle(name, on) { if (on === undefined) { this._set.has(name) ? this._set.delete(name) : this._set.add(name); } else if (on) this._set.add(name); else this._set.delete(name); },
      contains(name) { return this._set.has(name); }
    },
    appendChild(child) { element.children.push(child); element._children.push(child); child._up = element; return child; },
    removeChild(child) { return child; },
    setAttribute(name, value) { element.attributes[name] = String(value); },
    getAttribute(name) { return element.attributes[name] === undefined ? null : element.attributes[name]; },
    addEventListener(type, handler) {
      if (!element._handlers.has(type)) element._handlers.set(type, []);
      element._handlers.get(type).push(handler);
    },
    removeEventListener() {},
    /* Fire the gesture the way a finger does. Build 33 takes the menu's taps at
     * the sheet's root, in the capture phase, so a tap on a button reaches the
     * handler registered on its ancestor - exactly the path a WebView follows. */
    tap() {
      const event = { target: element, type: 'pointerdown', cancelable: true,
        preventDefault() {}, stopPropagation() {} };
      clock += 600;
      let node = element;
      while (node) {
        const handlers = node._handlers.get('pointerdown') || [];
        if (handlers.length > 0) {
          for (const handler of handlers) handler(event);
          return;
        }
        node = node._up;
      }
      assert.ok(false, 'the element, or a root above it, has a pointerdown handler');
    },
    querySelector(selector) {
      const key = String(selector);
      if (element._bySelector.has(key)) return element._bySelector.get(key);
      const named = /^\[(data-[a-z0-9-]+)(?:="([^"]*)")?\]$/.exec(key);
      if (named) {
        const found = attributesIn(element._html);
        if (!found.has(named[1])) { element._bySelector.set(key, null); return null; }
        if (named[2] !== undefined && !found.get(named[1]).includes(named[2])) { element._bySelector.set(key, null); return null; }
        const child = makeElement();
        if (named[1] === 'data-action') {
          child.dataset.action = named[2] === undefined ? '' : named[2];
        }
        element._bySelector.set(key, child);
        return child;
      }
      const child = makeElement();
      element._bySelector.set(key, child);
      return child;
    },
    querySelectorAll(selector) {
      const key = String(selector);
      const found = attributesIn(element._html);
      if (key === '[data-action]') {
        if (!element._bySelector.has(key)) {
          const actions = found.get('data-action') || [];
          /* The title screen's buttons are the ones with a data-action value;
           * each occurrence is its own element, as in the template. */
          const values = (String(element._html).match(/data-action="([^"]*)"/g) || []).map((piece) => piece.slice(13, -1));
          const buttons = values.map((value) => {
            const button = makeElement('button');
            button.dataset.action = value;
            button.attributes['data-action'] = value;
            button._up = element;
            return button;
          });
          element._bySelector.set(key, buttons);
          element._bySelector.set('data-action-list', buttons);
        }
        return element._bySelector.get(key);
      }
      return [];
    },
    closest(selector) {
      let node = element;
      while (node) {
        if (selector === '[data-action]' && node.dataset && node.dataset.action !== undefined) return node;
        node = node._up;
      }
      return null;
    },
    contains(node) {
      let walker = node;
      while (walker) {
        if (walker === element) return true;
        walker = walker._up;
      }
      return false;
    },
    get innerHTML() { return element._html; },
    set innerHTML(value) { element._html = String(value); element._bySelector.clear(); },
    get parentNode() {
      if (!element._parent) element._parent = makeElement();
      return element._parent;
    },
    remove() {}
  };
  return element;
};

const buildHarness = ({ pro = true, language = 'ja' } = {}) => {  const game = readGame();
  const sceneVars = game.layouts.find((layout) => layout.name === 'FROST LAB').variables;
  const values = new Map(sceneVars.map((variable) => [variable.name, variable.value]));
  const bag = (name) => ({
    getAsString: () => String(values.has(name) ? values.get(name) : ''),
    setString: (value) => values.set(name, String(value)),
    getAsNumber: () => Number(values.has(name) ? values.get(name) : 0) || 0,
    setNumber: (value) => values.set(name, Number(value)),
    getAsBoolean: () => values.get(name) === true,
    setBoolean: (value) => values.set(name, value === true)
  });
  const scene = {
    getVariables: () => ({ get: (name) => { if (!values.has(name)) values.set(name, 0); return bag(name); } }),
    getObjects: () => [],
    getGame: () => ({ getAssetPath: (path) => path })
  };
  const body = makeElement('body');
  const document = {
    body,
    head: makeElement('head'),
    documentElement: makeElement('html'),
    activeElement: null,
    createElement: (tagName) => makeElement(tagName),
    querySelector: (selector) => (String(selector) === '[data-ice-wolf-v110-online]'
      ? body.children.find((child) => child.attributes['data-ice-wolf-v110-online'] === '1') || null
      : null),
    querySelectorAll: () => [],
    addEventListener() {}
  };

  values.set('StageApplied', 'classic');
  values.set('StageId', 'classic');
  values.set('RoundPhase', 'Menu');
  values.set('MatchTimeLeft', 180);
  values.set('LanguageCommand', language);
  values.set('ProUnlocked', pro === true);

  const context = vm.createContext({
    runtimeScene: scene,
    gdjs: { evtTools: { runtimeScene: { getElapsedTimeInSeconds: () => 1 }, variables: {} } },
    document,
    navigator: { languages: [language], language },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    console,
    Date: TestDate,
    Math,
    JSON,
    Promise,
    Set,
    Map,
    Number,
    String,
    Array,
    Object,
    isFinite,
    encodeURIComponent,
    setTimeout,
    clearTimeout
  });
  const run = (group, label) => {
    const code = groupCode(group, game);
    vm.runInContext(`(function () {\n${code}\n})()`, context, { filename: `game.json#${label}` });
  };
  const frame = () => {
    run(ONLINE_GROUP, 'online core');
    run(LOBBY_GROUP, 'online lobby');
    run(STAMP_GROUP, 'quick stamps');
  };
  return { values, document, body, run, frame, scene };
};

const onlineButton = (body) => {
  const menuRoot = body.children[0];
  assert.ok(menuRoot, 'the title screen built its root');
  const buttons = menuRoot.querySelectorAll('[data-action]');
  const button = buttons.find((candidate) => candidate.dataset.action === 'online');
  assert.ok(button, 'the title screen has a [data-action="online"] button');
  return button;
};

const sheetOf = (body) => body.children.find((child) => child.attributes['data-ice-wolf-v110-online'] === '1') || null;

test('the ONLINE button opens the lobby: the sheet on the page is the one the lobby built', () => {
  const harness = buildHarness({ pro: true });
  harness.run(I18N_GROUP, 'i18n');
  harness.run(MENU_GROUP, 'menu');
  harness.frame();

  /* The sheet is built on the first frame whether or not anybody asked for it;
   * what matters is that the menu leaves it hidden and the button shows it. */
  const before = sheetOf(harness.body);
  assert.ok(before, 'the lobby put its sheet in the page on the first frame');
  assert.notEqual(before.style.display, 'flex', 'and the title screen keeps it hidden');
  assert.equal(before.classList.contains('iwo-show'), false, 'the shown class is off');

  onlineButton(harness.body).tap();
  harness.frame();

  const sheet = sheetOf(harness.body);
  assert.equal(sheet.style.display, 'flex', 'the tap displays the sheet, not leaves it at display:none');
  assert.equal(sheet.classList.contains('iwo-show'), true, 'the shown class is on it');
  assert.equal(harness.values.get('OnlineLobbyOpen'), true, 'the state agrees with the screen');
  assert.equal(harness.values.get('OnlineLobbyReady'), true);
  assert.ok(String(sheet.querySelector('[data-online-title]').textContent).length > 0, 'the title line is filled');
  assert.ok(String(sheet.querySelector('[data-online-join]').textContent).length > 0, 'JOIN says what it does');
  assert.ok(String(sheet.querySelector('[data-online-createlabel]').textContent).length > 0, 'CREATE says what it does');
});

test('the sheet closes and comes back, and it stays up in front of the title', () => {
  const harness = buildHarness({ pro: true });
  harness.run(I18N_GROUP, 'i18n');
  harness.run(MENU_GROUP, 'menu');
  harness.frame();

  onlineButton(harness.body).tap();
  harness.frame();
  const sheet = sheetOf(harness.body);

  sheet.querySelector('[data-online-close]').tap();
  harness.frame();
  assert.equal(sheet.style.display, 'none', 'the ✕ closes it');
  assert.equal(harness.values.get('OnlineLobbyOpen'), false, 'and the state follows');

  onlineButton(harness.body).tap();
  harness.frame();
  assert.equal(sheet.style.display, 'flex', 'the same sheet opens again from the menu');
  assert.equal(harness.values.get('OnlineLobbyOpen'), true);
});

test('a Pro host creates a room from the sheet and reads the code back', () => {
  const harness = buildHarness({ pro: true });
  harness.run(I18N_GROUP, 'i18n');
  harness.run(MENU_GROUP, 'menu');
  harness.frame();
  onlineButton(harness.body).tap();
  harness.frame();
  const sheet = sheetOf(harness.body);

  sheet.querySelector('[data-online-create]').tap();
  harness.frame();

  const code = String(harness.values.get('OnlineRoomCode'));
  assert.equal(code.length, 6, `the room has a six character code: ${code}`);
  assert.equal(harness.values.get('OnlineIsHost'), true, 'the creator hosts');
  assert.equal(sheet.querySelector('[data-online-roomcode]').textContent, code, 'the sheet shows that code');
  assert.equal(sheet.style.display, 'flex', 'and the sheet is still on the screen while the room stands');
  assert.ok(sheet.querySelector('[data-online-roommeta]').textContent.length > 0, 'the room line names its rules');
});

test('a free player is offered Pro instead of a room, and still sees the sheet', () => {
  const harness = buildHarness({ pro: false });
  harness.run(I18N_GROUP, 'i18n');
  harness.run(MENU_GROUP, 'menu');
  harness.frame();
  onlineButton(harness.body).tap();
  harness.frame();
  const sheet = sheetOf(harness.body);

  assert.equal(sheet.style.display, 'flex', 'the free player gets the sheet too');

  sheet.querySelector('[data-online-create]').tap();
  harness.frame();
  assert.equal(String(harness.values.get('OnlineRoomCode')), '', 'no room for a free player');
  assert.ok(String(sheet.querySelector('[data-online-note]').textContent).length > 0, 'the sheet says why');
});
