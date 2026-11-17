// Helpers shared by the Pro (v1.1.0) tests.
//
// The tests read game.json itself and evaluate the shipping code, so what they
// check is exactly what the app runs: the 12-language table of the i18n group,
// and the store/view model between the `v1.1.0 Pro store` markers.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const gamePath = path.join(repoRoot, 'game.json');

export const LANGS = ['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko', 'es', 'fr', 'de', 'pt', 'it', 'hi', 'id'];
export const KANA = /[\u3040-\u30fa\u30fc-\u30ff]/;

export const readGame = () => JSON.parse(fs.readFileSync(gamePath, 'utf8'));

export const sceneOf = (data) => data.layouts.find((layout) => layout.name === 'FROST LAB');

export const codeOf = (event) => (Array.isArray(event.inlineCode) ? event.inlineCode.join('\n') : event.inlineCode || '');

export const groupCode = (name, data = readGame()) => {
  const group = sceneOf(data).events.find((event) => event.name === name);
  if (!group) throw new Error(`event group not found: ${name}`);
  return codeOf(group.events[0]);
};

export const PRO_GROUP = 'v1.1.0 Pro 購入・復元UI';
export const I18N_GROUP = 'v1.0.0 12言語 i18n';

export const proBlock = (data) => {
  const code = groupCode(PRO_GROUP, data);
  const start = code.indexOf('/* ==== v1.1.0 Pro store');
  const end = code.indexOf('/* ==== end v1.1.0 Pro store ==== */');
  if (start < 0 || end < 0) throw new Error('the Pro store markers are missing from the Pro group');
  return code.slice(start, end);
};

const makeElement = () => {
  const element = {
    dataset: {},
    style: {},
    classList: { toggle() {}, add() {}, remove() {} },
    children: [],
    attributes: {},
    textContent: '',
    className: '',
    appendChild(child) { this.children.push(child); return child; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name]; },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  return element;
};

const memoryStorage = (seed = {}) => {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
    clear: () => data.clear(),
    size: () => data.size,
    // the store's own interface (the game passes localStorage through a guard)
    get: (key) => (data.has(key) ? data.get(key) : ''),
    set: (key, value) => { data.set(key, String(value)); }
  };
};

export { memoryStorage };

const variableBag = () => {
  const values = new Map();
  const read = (name) => ({
    getAsString: () => String(values.get(name) ?? ''),
    setString: (value) => { values.set(name, String(value)); },
    getAsNumber: () => Number(values.get(name) ?? 0),
    setNumber: (value) => { values.set(name, Number(value)); },
    getAsBoolean: () => values.get(name) === true,
    setBoolean: (value) => { values.set(name, value === true); }
  });
  return { get: read, values };
};

// The shipping 12-language table, evaluated with the minimum DOM the i18n group
// touches (its language picker) so `t()`, `keys()`, `audit()` and `setLang()`
// are the real ones.
export const createI18n = ({ language = 'ja', storage = {} } = {}) => {
  const document = {
    body: makeElement(),
    documentElement: { lang: '' },
    createElement: () => makeElement(),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}
  };
  const local = memoryStorage(storage);
  const context = vm.createContext({
    runtimeScene: { getVariables: () => variableBag(), getObjects: () => [], getGame: () => ({ getAssetPath: () => '' }) },
    document,
    localStorage: local,
    navigator: { languages: [language], language }
  });
  const code = groupCode(I18N_GROUP);
  vm.runInContext(code, context, { filename: 'game.json#v1.0.0 12言語 i18n' });
  const i18n = context.runtimeScene.__iceWolfI18n;
  if (!i18n) throw new Error('the i18n group did not publish runtimeScene.__iceWolfI18n');
  return { i18n, context, storage: local };
};

export const loadProCode = () => {
  const code = proBlock();
  /* The game runs this in a WebView, where timers exist; the sandbox gets the
   * host's timers so the timeout path can be tested for real. */
  const context = vm.createContext({ setTimeout, clearTimeout, console });
  vm.runInContext(
    `${code}\n;globalThis.__pro = { createIceWolfProStore, iceWolfProView, createIceWolfProFakeAdapter, ICE_WOLF_PRO_PRODUCT_ID, ICE_WOLF_PRO_STORAGE_KEY };`,
    context,
    { filename: 'game.json#v1.1.0 Pro store' }
  );
  return { ...context.__pro, source: code };
};
