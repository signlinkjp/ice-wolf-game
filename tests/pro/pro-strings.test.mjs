// The Pro screen in all twelve languages: every line comes from the shipping
// table, nothing is missing, and no Japanese is left inside a translation.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createI18n, groupCode, loadProCode, LANGS, KANA, PRO_GROUP } from './helpers.mjs';

const PRO_KEYS = [
  'pro.menu', 'pro.settings', 'pro.title', 'pro.free', 'pro.unlocked',
  'pro.statusFree', 'pro.statusPro', 'pro.statusWeb', 'pro.priceLine',
  'pro.buy', 'pro.owned', 'pro.purchasing', 'pro.restore', 'pro.restoring',
  'pro.thanks', 'pro.restored', 'pro.cancelled', 'pro.pending',
  'pro.nothingToRestore', 'pro.storeUnavailable', 'pro.failed',
  'pro.comingSoon', 'pro.soon1', 'pro.soon2', 'pro.soon3', 'pro.soonNote',
  'pro.note', 'pro.close'
];

test('the table carries every Pro line in all twelve languages', () => {
  const { i18n } = createI18n();
  const keys = i18n.keys().filter((key) => key.startsWith('pro.'));
  assert.deepEqual([...keys].sort(), [...PRO_KEYS].sort(), 'the pro.* key list is exactly the one the screen uses');
  for (const key of PRO_KEYS) {
    assert.equal(i18n.ja(key).length > 0, true, `${key} has a Japanese line`);
    for (const lang of LANGS) {
      i18n.setLang(lang);
      const line = i18n.t(key);
      assert.ok(line.length > 0, `${key} [${lang}] is not empty`);
      if (lang !== 'ja' && lang !== 'zh-Hans' && lang !== 'zh-Hant') {
        assert.equal(KANA.test(line), false, `${key} [${lang}] has no Japanese kana: ${line}`);
      }
    }
  }
  i18n.setLang('ja');
});

test('the whole 12-language table still audits clean after the Pro lines', () => {
  const { i18n } = createI18n();
  const audit = i18n.audit();
  assert.equal(audit.missing.length, 0, `no key is missing a language: ${[...audit.missing].join(',')}`);
  assert.equal(audit.leaks.length, 0, `no Japanese leaked into a translation: ${[...audit.leaks].join(',')}`);
  assert.ok(audit.keys >= 138, `the table holds the 110 v1.0.0 keys and the 28 Pro keys: ${audit.keys}`);
});

test('every key the Pro screen reads exists in the table, and no Pro key is dead', () => {
  const { i18n } = createI18n();
  const code = groupCode(PRO_GROUP);
  const used = new Set([...code.matchAll(/'(pro\.[a-zA-Z0-9]+)'/g)].map((match) => match[1]));
  const menu = groupCode('v0.6.5 Production Round Start + Main Menu');
  for (const key of ['pro.menu', 'pro.settings']) {
    assert.ok(menu.includes(`'${key}'`) || menu.includes(`"${key}"`) || menu.includes(`data-i18n="${key}"`), `${key} labels the menu / SETTINGS`);
    used.add(key);
  }
  assert.ok(used.size >= 28, `the screen names its lines (${used.size})`);
  const keys = new Set(i18n.keys());
  for (const key of used) assert.ok(keys.has(key), `${key} is in the table`);
  for (const key of PRO_KEYS) assert.ok(used.has(key), `${key} is actually used by the screen`);
});

test('the view model speaks all twelve languages in every state', () => {
  const { i18n } = createI18n();
  const { iceWolfProView } = loadProCode();
  const states = [
    { name: 'free, store present', snapshot: { status: 'ready', pro: false, available: true, priceText: '¥500' }, message: '' },
    { name: 'free, no store', snapshot: { status: 'unavailable', pro: false, available: false }, message: 'pro.storeUnavailable' },
    { name: 'purchased', snapshot: { status: 'purchased', pro: true, available: true, priceText: '¥500' }, message: 'pro.thanks' },
    { name: 'restored', snapshot: { status: 'restored', pro: true, available: true }, message: 'pro.restored' },
    { name: 'cancelled', snapshot: { status: 'cancelled', pro: false, available: true }, message: 'pro.cancelled' },
    { name: 'pending', snapshot: { status: 'pending', pro: false, available: true }, message: 'pro.pending' },
    { name: 'nothing to restore', snapshot: { status: 'nothing', pro: false, available: true }, message: 'pro.nothingToRestore' },
    { name: 'failed', snapshot: { status: 'failed', pro: false, available: true }, message: 'pro.failed' },
    { name: 'purchasing', snapshot: { status: 'purchasing', pro: false, available: true, busy: true }, message: '' }
  ];
  for (const lang of LANGS) {
    i18n.setLang(lang);
    for (const state of states) {
      const view = iceWolfProView(state.snapshot, (key, params) => i18n.t(key, params), lang);
      const where = `${state.name} [${lang}]`;
      assert.equal(view.title, i18n.t('pro.title'), `${where}: title`);
      assert.equal(view.status, i18n.t(state.snapshot.pro ? 'pro.statusPro' : (state.snapshot.available === false && state.snapshot.status !== 'idle' ? 'pro.statusWeb' : 'pro.statusFree')), `${where}: status line`);
      assert.equal(view.message, state.message ? i18n.t(state.message) : '', `${where}: message`);
      assert.equal(view.badge, i18n.t(state.snapshot.pro ? 'pro.unlocked' : 'pro.free'), `${where}: badge`);
      assert.equal(view.restoreLabel, i18n.t(state.snapshot.status === 'restoring' ? 'pro.restoring' : 'pro.restore'), `${where}: restore label`);
      assert.equal(view.closeLabel, i18n.t('pro.close'), `${where}: close label`);
      assert.equal(view.items.length, 3, `${where}: three future-content rows`);
      assert.equal(view.items[0], i18n.t('pro.soon1'), `${where}: first future row`);
      assert.equal(view.soonNote, i18n.t('pro.soonNote'), `${where}: future-content note`);
      assert.equal(view.note, i18n.t('pro.note'), `${where}: purchase note`);
      if (state.snapshot.priceText) {
        assert.equal(view.priceLine, i18n.t('pro.priceLine', { p: state.snapshot.priceText }), `${where}: price line`);
        assert.ok(view.priceLine.includes(state.snapshot.priceText), `${where}: the store price is shown verbatim`);
      } else {
        /* No store answer yet: the settled price may stand in — ¥500 in Japanese,
         * the nearest US tier in English, and nothing where a currency guess
         * would be worse than an empty line. */
        const fallback = state.snapshot.pro === true ? '' : (lang === 'ja' ? '¥500' : (lang === 'en' ? '$2.99' : ''));
        assert.equal(view.priceLine, fallback ? i18n.t('pro.priceLine', { p: fallback }) : '',
          `${where}: the settled price, or nothing before the store answers`);
      }
      if (lang !== 'ja' && lang !== 'zh-Hans' && lang !== 'zh-Hant') {
        for (const line of [view.status, view.restoreLabel, view.closeLabel, view.note, view.soonNote, view.buyLabel]) {
          assert.equal(KANA.test(line), false, `${where}: no Japanese kana in "${line}"`);
        }
      }
    }
  }
  i18n.setLang('ja');
});

test('the buy button follows the state (free / owned / working)', () => {
  const { i18n } = createI18n();
  const { iceWolfProView } = loadProCode();
  const tr = (key, params) => i18n.t(key, params);
  const free = iceWolfProView({ status: 'ready', pro: false, available: true }, tr);
  assert.equal(free.buyLabel, i18n.t('pro.buy'));
  assert.equal(free.canBuy, true, 'a free player can buy');
  const working = iceWolfProView({ status: 'purchasing', pro: false, available: true, busy: true }, tr);
  assert.equal(working.buyLabel, i18n.t('pro.purchasing'));
  assert.equal(working.canBuy, false, 'the button is closed while StoreKit is working');
  const owned = iceWolfProView({ status: 'purchased', pro: true, available: true }, tr);
  assert.equal(owned.buyLabel, i18n.t('pro.owned'));
  assert.equal(owned.canBuy, false, 'an owned product cannot be bought again');
  assert.equal(owned.canRestore, true, 'restore stays available');
});

test('the Pro lines sit on the Pro screen, not on the old ones', () => {
  const code = groupCode(PRO_GROUP);
  for (const attribute of ['data-pro-title', 'data-pro-badge', 'data-pro-status', 'data-pro-price', 'data-pro-message', 'data-pro-buy', 'data-pro-restore', 'data-pro-close']) {
    assert.ok(code.includes(attribute), `the screen has an element for ${attribute}`);
  }
  assert.ok(code.includes('jp.signlink.IceWolf.pro'), 'the product id is in the screen code');
  assert.ok(code.includes('IceWolfStoreKit'), 'the native plugin name is what the bridge asks for');
});
