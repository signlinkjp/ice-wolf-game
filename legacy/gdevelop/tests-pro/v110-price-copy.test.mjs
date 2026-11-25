// The v1.1.0 Phase 2c price decision and the copy it has to agree with.
//
//   * the PRO price the user settled (¥500, non-consumable) is the only price
//     the app ever names itself; StoreKit's displayPrice still wins when the
//     store answers, and the US tier is a store-side choice ($2.99 / $3.99);
//   * the tagline, the gate line and HOW TO PLAY say the same thing about how a
//     round is won, in all twelve languages, with nothing missing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createI18n, loadProCode, gamePath, LANGS, KANA } from './helpers.mjs';

const { iceWolfProView, createIceWolfProFakeAdapter, ICE_WOLF_PRO_FALLBACK_PRICE } = loadProCode();

/* A tr() that shows which key and which parameter it was handed, so a test can
 * prove the price line came from the table and not from a literal. */
const tr = (key, params) => `${key}${params && params.p ? '|' + params.p : ''}`;

test('the settled price is ¥500, and the store price still wins over it', () => {
  assert.equal(ICE_WOLF_PRO_FALLBACK_PRICE, '¥500', 'the user settled on ¥500');

  /* Before the store answers, the Japanese screen may name the settled price. */
  const free = iceWolfProView({ status: 'idle', pro: false, available: true }, tr, 'ja');
  assert.equal(free.priceLine, 'pro.priceLine|¥500');

  /* English falls back to the nearest US tier, and every other language waits
   * for the store rather than guessing a currency. */
  assert.equal(iceWolfProView({ status: 'ready', pro: false, available: true }, tr, 'en').priceLine, 'pro.priceLine|$2.99');
  for (const lang of ['zh-Hans', 'zh-Hant', 'ko', 'es', 'fr', 'de', 'pt', 'it', 'hi', 'id']) {
    assert.equal(iceWolfProView({ status: 'ready', pro: false, available: true }, tr, lang).priceLine, '',
      `${lang} shows the store price only`);
  }

  /* Whatever the App Store says wins, verbatim: a US $3.99 tier is $3.99 even
   * on a Japanese phone. */
  const store = iceWolfProView({ status: 'ready', pro: false, available: true, priceText: '¥500' }, tr, 'ja');
  assert.equal(store.priceLine, 'pro.priceLine|¥500');
  const usStore = iceWolfProView({ status: 'ready', pro: false, available: true, priceText: '$3.99' }, tr, 'ja');
  assert.equal(usStore.priceLine, 'pro.priceLine|$3.99', 'the store price is shown instead of the fallback');
  const deStore = iceWolfProView({ status: 'ready', pro: false, available: true, priceText: '4,99 €' }, tr, 'de');
  assert.equal(deStore.priceLine, 'pro.priceLine|4,99 €');

  /* An owner is not quoted a price they already paid. */
  const owned = iceWolfProView({ status: 'purchased', pro: true, available: true }, tr, 'ja');
  assert.equal(owned.priceLine, '', 'no price on an owned product without a store answer');
});

test('the fake StoreKit (the harness and the tests) answers ¥500, and ¥610 is gone', () => {
  assert.equal(createIceWolfProFakeAdapter('ok').proStatus().priceText, '¥500');
  assert.equal(createIceWolfProFakeAdapter('ok', { priceText: '¥4.99' }).proStatus().priceText, '¥4.99',
    'an explicit price still wins in a test');
  const game = fs.readFileSync(gamePath, 'utf8');
  assert.equal(game.includes('¥610'), false, 'the old ¥610 fallback is nowhere in the project');
  assert.ok(game.includes('ICE_WOLF_PRO_FALLBACK_PRICE'), 'the fallback has one home');
  assert.ok(game.includes('ICE_WOLF_PRO_FALLBACK_PRICE_US'), 'and so does the US tier note');
  assert.ok(game.includes('$2.99') && game.includes('$3.99'), 'both neighbouring US tiers are named');
});

/* How each language says "all" in the tagline: the wolf wins by freezing every
 * human, so a tagline that says "freeze them" without "all" promises less than
 * the round does. */
const TAG_ALL = {
  ja: '全員', en: 'all', 'zh-Hans': '所有', 'zh-Hant': '所有', ko: '모두', es: 'todos',
  fr: 'tous', de: 'alle', pt: 'todos', it: 'tutti', hi: 'सबको', id: 'semua'
};
/* The two ways a human wins, as HOW TO PLAY writes them. */
const HUMAN_PATHS = {
  ja: ['脱出', '生き残'], en: ['escape', 'survive'], 'zh-Hans': ['逃出去', '坚持'],
  'zh-Hant': ['逃出去', '堅持'], ko: ['탈출', '살아남'], es: ['escapar', 'sobrevive'],
  fr: ['échapper', 'survivez'], de: ['entkomme', 'überlebe'], pt: ['escapar', 'sobreviva'],
  it: ['fuggire', 'sopravvivi'], hi: ['भाग निकलो', 'ज़िंदा रहो'], id: ['kabur', 'bertahan']
};
/* The gate word the escape line has to name. */
const GATE_WORD = {
  ja: 'ゲート', en: 'gate', 'zh-Hans': '大门', 'zh-Hant': '大門', ko: '게이트', es: 'puerta',
  fr: 'porte', de: 'Tor', pt: 'port', it: 'cancello', hi: 'गेट', id: 'gerbang'
};

test('the tagline, the gate line and HOW TO PLAY agree on how a round is won', () => {
  const { i18n } = createI18n({ language: 'ja' });
  for (const lang of LANGS) {
    i18n.setLang(lang);
    const where = `[${lang}]`;
    const tagline = i18n.t('menu.tagline');
    const gate = i18n.t('hud.gateEscape');
    const how = i18n.t('how.items');
    const wolfWin = i18n.t('hud.wolfWin');
    const humanWin = i18n.t('hud.humanWin');

    assert.ok(tagline.trim().length > 0, `${where} the tagline is there`);
    assert.ok(how.trim().length > 0, `${where} HOW TO PLAY is there`);
    assert.ok(gate.trim().length > 0, `${where} the gate line is there`);
    assert.ok(wolfWin.trim().length > 0 && humanWin.trim().length > 0, `${where} both endings are there`);
    assert.notEqual(wolfWin, humanWin, `${where} the two endings are different words`);

    /* "freeze them ALL" is the wolf's win condition, in every language. */
    assert.ok(tagline.includes(TAG_ALL[lang]), `${where} the tagline says all: ${tagline}`);

    /* HOW TO PLAY gives the humans both paths: the gate, and outlasting the clock. */
    for (const word of HUMAN_PATHS[lang]) {
      assert.ok(how.includes(word), `${where} HOW TO PLAY names "${word}"`);
    }

    /* The escape line names the gate, so "escaped" cannot mean "survived". */
    assert.ok(gate.includes(GATE_WORD[lang]), `${where} the win line names the gate: ${gate}`);
    assert.equal(gate.includes(wolfWin), false, `${where} the gate line is not the wolf's line`);

    /* A translated line is a translation: no Japanese kana outside the three
     * languages that use them. */
    if (lang !== 'ja' && lang !== 'zh-Hans' && lang !== 'zh-Hant') {
      for (const [label, line] of [['tagline', tagline], ['gate', gate], ['how', how]]) {
        assert.equal(KANA.test(line), false, `${where} ${label} has no Japanese kana`);
      }
    }
  }
  i18n.setLang('ja');
});

test('the table still has every line in every language, including the host-loss one', () => {
  const { i18n } = createI18n();
  const audit = i18n.audit();
  assert.equal(audit.missing.length, 0, `no key is missing a language: ${[...audit.missing].join(',')}`);
  assert.equal(audit.leaks.length, 0, `no Japanese leaked into a translation: ${[...audit.leaks].join(',')}`);
  assert.ok(audit.keys >= 139, `the table holds the 138 keys and the host-loss one: ${audit.keys}`);
  for (const lang of LANGS) {
    i18n.setLang(lang);
    assert.ok(i18n.t('online.hostLost').trim().length > 0, `${lang} says what a lost host means`);
  }
  i18n.setLang('ja');
  assert.equal(i18n.t('online.hostLost'), 'ホストとの通信が切れました。試合を終了します。');
  assert.equal(i18n.t('menu.tagline'), '人狼を見抜け。全員凍らせるか、脱出しろ。',
    'the Japanese tagline promised less than the round: it says 全員 now');
});
