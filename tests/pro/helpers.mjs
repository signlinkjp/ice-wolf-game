// Helpers shared by the Pro (v1.1.0) tests.
//
// The tests read game.json itself and evaluate the shipping code, so what they
// check is exactly what the app runs: the 12-language table of the i18n group,
// and the store/view model between the `v1.1.0 Pro store` markers.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const gamePath = path.join(repoRoot, 'game.json');
export const assetPath = (name) => path.join(repoRoot, 'assets', name);

/* The smallest PNG reader the checks need: an 8-bit picture, palette or RGB,
 * read back into pixels so a texture can be measured rather than described. */
export const decodePng = (file) => {
  const buffer = fs.readFileSync(file);
  if (buffer.toString('latin1', 1, 4) !== 'PNG') throw new Error(`${path.basename(file)} is not a PNG`);
  let offset = 8;
  let width = 0;
  let height = 0;
  let depth = 8;
  let colour = 2;
  let palette = null;
  const chunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colour = data[9];
    } else if (type === 'PLTE') {
      palette = data;
    } else if (type === 'IDAT') {
      chunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  if (depth !== 8) throw new Error(`${path.basename(file)} is not an 8-bit PNG`);
  const channels = colour === 6 ? 4 : colour === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let previous = Buffer.alloc(stride);
  let cursor = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor];
    cursor += 1;
    const line = Buffer.from(raw.subarray(cursor, cursor + stride));
    cursor += stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? line[x - channels] : 0;
      const up = previous[x];
      const upLeft = x >= channels ? previous[x - channels] : 0;
      if (filter === 1) line[x] = (line[x] + left) & 255;
      else if (filter === 2) line[x] = (line[x] + up) & 255;
      else if (filter === 3) line[x] = (line[x] + ((left + up) >> 1)) & 255;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const pa = Math.abs(estimate - left);
        const pb = Math.abs(estimate - up);
        const pc = Math.abs(estimate - upLeft);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 255;
      }
    }
    line.copy(pixels, y * stride);
    previous = line;
  }
  return { width, height, colour, channels, palette, pixels, stride };
};

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
    `${code}\n;globalThis.__pro = { createIceWolfProStore, iceWolfProView, createIceWolfProFakeAdapter, ICE_WOLF_PRO_PRODUCT_ID, ICE_WOLF_PRO_STORAGE_KEY, ICE_WOLF_PRO_FALLBACK_PRICE, ICE_WOLF_PRO_FALLBACK_PRICE_US, iceWolfProFallbackPrice };`,
    context,
    { filename: 'game.json#v1.1.0 Pro store' }
  );
  return { ...context.__pro, source: code };
};
