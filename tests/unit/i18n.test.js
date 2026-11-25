/**
 * The text layer must be complete in all twelve languages before layout is
 * checked: a missing string shows a key on a player's phone.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEXTS, LANG_ORDER, STAMP_IDS, stampText } from '../../src/i18n.js';
import { LANGUAGES } from '../../src/config.js';

// U+30FB (・) is a shared CJK separator, not kana.
const KANA = /[\u3040-\u30fa\u30fc-\u30ff]/;

test('the language order is the shipping order', () => {
  assert.deepEqual(LANG_ORDER, LANGUAGES);
  assert.equal(LANG_ORDER.length, 12);
});

test('every key carries twelve non-empty strings', () => {
  for (const [key, row] of Object.entries(TEXTS)) {
    assert.equal(row.length, 12, `${key} has ${row.length} entries`);
    row.forEach((s, i) => {
      assert.equal(typeof s, 'string', `${key}[${i}] is not a string`);
      assert.ok(s.trim().length > 0, `${key}[${LANG_ORDER[i]}] is empty`);
    });
  }
});

test('no Japanese kana leaks into the other eleven languages', () => {
  for (const [key, row] of Object.entries(TEXTS)) {
    row.forEach((s, i) => {
      if (LANG_ORDER[i] === 'ja') return;
      // Brand and format markers are Latin; kana anywhere else is a leak.
      assert.ok(!KANA.test(s), `${key} leaks Japanese into ${LANG_ORDER[i]}: ${s}`);
    });
  }
});

test('placeholders agree across all twelve languages', () => {
  const marks = (s) => (s.match(/\{[a-z]+\}/g) || []).sort().join(',');
  for (const [key, row] of Object.entries(TEXTS)) {
    const want = marks(row[0]);
    row.forEach((s, i) => {
      assert.equal(marks(s), want, `${key} placeholders differ in ${LANG_ORDER[i]}`);
    });
  }
});

test('every stamp has a line in every language', () => {
  for (const id of STAMP_IDS) {
    for (const lang of LANG_ORDER) {
      const s = stampText(id, lang);
      assert.ok(s && s !== `stamp.${id}`, `stamp ${id} missing ${lang}`);
      if (lang !== 'ja') assert.ok(!KANA.test(s), `stamp ${id} leaks Japanese in ${lang}`);
    }
  }
});

test('the keys the online layer sends exist', () => {
  for (const key of ['online.leave', 'online.hostLost', 'hud.spectate', 'result.humanWin', 'result.wolfWin']) {
    assert.ok(TEXTS[key], `${key} missing`);
  }
});
