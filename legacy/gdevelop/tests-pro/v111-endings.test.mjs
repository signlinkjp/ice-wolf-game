// ICE WOLF Build 20: the result screen names the round that just ended.
//
// Build 19 showed 人間の勝利 / 時間切れで決着 over an arena with 2:24 left, every
// gate still locked and the player (the wolf) alive. The round itself had ended
// correctly — the last human had just been frozen, which is the wolves' win —
// but the result panel read the win line through `__iceWolfHudSource`, which
// answers with the line the HUD pass remembered. That pass runs AFTER the result
// panel in a frame, so on the frame an ending is written by the match flow or by
// the survivor counter the panel was still reading the PREVIOUS round's line,
// and the note was guessed from it ("not the gate, not the wolf → time").
//
// This file proves the two halves of the fix:
//
//   * a line the events have just rewritten is its own source, even when the
//     pass has not run yet (and an empty line is never last round's line);
//   * every ending writes WinWinner / WinReason, and the panel, the record, the
//     sound cue and the host snapshot read those instead of sniffing a line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import { readGame, sceneOf, groupCode } from './helpers.mjs';

const HUD_GROUP = 'v1.0.0 HUD 多言語反映';
const MENU_GROUP = 'v0.6.5 Production Round Start + Main Menu';
const FLOW_GROUP = 'Wolf match flow';

const variableBag = (seed = {}) => {
  const values = new Map(Object.entries(seed));
  return {
    values,
    get: (name) => ({
      getAsString: () => String(values.get(name) ?? ''),
      setString: (value) => { values.set(name, String(value)); },
      getAsNumber: () => Number(values.get(name) ?? 0),
      setNumber: (value) => { values.set(name, Number(value)); },
      getAsBoolean: () => values.get(name) === true,
      setBoolean: (value) => { values.set(name, value === true); }
    }),
    read: (name) => values.get(name)
  };
};

const winTextObject = () => ({
  text: '',
  getString() { return this.text; },
  setString(value) { this.text = String(value); }
});

/* Every code block of a group (some groups hold more than one). */
const groupCodeAll = (name) => {
  const group = sceneOf(readGame()).events.find((event) => event.name === name);
  if (!group) throw new Error(`event group not found: ${name}`);
  const collect = (event) => {
    const own = Array.isArray(event.inlineCode) ? event.inlineCode.join('\n') : event.inlineCode || '';
    return [own, ...(event.events || []).map(collect)].join('\n');
  };
  return (group.events || []).map(collect).join('\n');
};

/* The HUD pass, run against one WinText object the way the frame runs it. */
const hudPass = (object) => {
  const items = new Map([['WinText', [object]]]);
  const box = variableBag();
  const runtimeScene = {
    __iceWolfI18n: { hud: (line) => line, t: (key) => key, lang: 'ja' },
    getVariables: () => box,
    getObjects: (name) => items.get(name) || []
  };
  const context = vm.createContext({ runtimeScene, console });
  const code = groupCode(HUD_GROUP);
  return {
    step: (times = 1) => {
      /* One block per frame, so the group's `const`s do not collide. */
      for (let index = 0; index < times; index += 1) vm.runInContext(`{\n${code}\n}`, context, { filename: 'game.json#hud pass' });
    },
    source: (name = 'WinText') => runtimeScene.__iceWolfHudSource(name)
  };
};

/* The ending model, taken out of the menu group exactly as it ships. */
const endingModel = () => {
  const code = groupCode(MENU_GROUP);
  const open = code.indexOf('/* ==== v1.1.0 ending model');
  const close = code.indexOf('/* ==== end v1.1.0 ending model ==== */');
  if (open < 0 || close < 0) throw new Error('the ending-model markers are missing from the menu group');
  const context = vm.createContext({});
  vm.runInContext(`${code.slice(open, close)}
    ;globalThis.__ending = { iceWolfEndingCopy, iceWolfWinWinner, iceWolfWinReason };`,
  context, { filename: 'game.json#ending model' });
  return context.__ending;
};

const tr = (key) => `t:${key}`;

/* ------------------------------------------------- 1. the live line is the source */
test('a win line the events rewrote this frame is its own source', () => {
  const object = winTextObject();
  const pass = hudPass(object);

  /* The previous round ended for the humans. */
  object.text = '人間の勝利';
  pass.step();
  assert.equal(pass.source(), '人間の勝利');

  /* A new round starts: the line is cleared, and the panel must not answer
   * with the old one. */
  object.text = '';
  pass.step();
  assert.equal(pass.source(), '', 'a cleared line is not last round\'s line');

  /* The wolves now freeze the last human: the survivor counter writes the line
   * and the result panel of this same frame reads it. The HUD pass has not run
   * yet — this is exactly the frame that used to say 人間の勝利. */
  object.text = '人狼の勝利';
  assert.equal(pass.source(), '人狼の勝利', 'the panel reads the line written this frame');
  pass.step();
  assert.equal(pass.source(), '人狼の勝利');
});

test('a translated line still answers with its Japanese source', () => {
  const object = winTextObject();
  const items = new Map([['WinText', [object]]]);
  const box = variableBag();
  const runtimeScene = {
    __iceWolfI18n: {
      hud: (line) => (line === '人狼の勝利' ? 'WOLVES WIN' : line),
      t: (key) => key,
      lang: 'en'
    },
    getVariables: () => box,
    getObjects: (name) => items.get(name) || []
  };
  const context = vm.createContext({ runtimeScene, console });
  const code = groupCode(HUD_GROUP);
  object.text = '人狼の勝利';
  vm.runInContext(code, context, { filename: 'game.json#hud pass' });
  assert.equal(object.text, 'WOLVES WIN', 'the HUD shows the chosen language');
  assert.equal(runtimeScene.__iceWolfHudSource('WinText'), '人狼の勝利',
    'the record and the sound read the Japanese source behind the translation');
});

/* ------------------------------------------------------ 2. the ending model */
test('the result copy names the side and the reason the ending wrote', () => {
  const { iceWolfEndingCopy } = endingModel();

  /* The reported round: the wolves froze everyone, and last round's line is
   * still lying around in the text object. */
  const frozen = iceWolfEndingCopy(tr, variableBag({ WinWinner: 'wolf', WinReason: 'frozen' }), '人間の勝利');
  assert.equal(frozen.winner, 'wolf');
  assert.equal(frozen.reason, 'frozen');
  assert.equal(frozen.title, 't:hud.wolfWin');
  assert.equal(frozen.note, 't:result.noteFrozen');

  const time = iceWolfEndingCopy(tr, variableBag({ WinWinner: 'human', WinReason: 'time' }), '');
  assert.equal(time.title, 't:hud.humanWin');
  assert.equal(time.note, 't:result.noteTime');

  const gate = iceWolfEndingCopy(tr, variableBag({ WinWinner: 'human', WinReason: 'gate' }), '人狼の勝利');
  assert.equal(gate.title, 't:hud.humanWin');
  assert.equal(gate.note, 't:result.noteGate');

  /* Nothing decided yet: the panel says RESULT with no note, never a guess. */
  const none = iceWolfEndingCopy(tr, variableBag(), '');
  assert.equal(none.winner, '');
  assert.equal(none.title, 't:result.title');
  assert.equal(none.note, '');
});

test('a round that ended before the variables existed still reads its line', () => {
  const { iceWolfEndingCopy } = endingModel();
  const wolf = iceWolfEndingCopy(tr, variableBag(), '人狼の勝利');
  assert.equal(wolf.winner, 'wolf');
  assert.equal(wolf.note, 't:result.noteFrozen');
  const human = iceWolfEndingCopy(tr, variableBag(), '人間の勝利');
  assert.equal(human.winner, 'human');
  assert.equal(human.note, 't:result.noteTime');
});

test('the gate flag alone still says the humans escaped', () => {
  const { iceWolfWinReason } = endingModel();
  const reason = iceWolfWinReason(variableBag({ EscapeWonByGate: true }), 'human', '人間の勝利');
  assert.equal(reason, 'gate');
});

/* --------------------------------------------- 3. every ending writes its own */
const nativeEndings = () => {
  const group = sceneOf(readGame()).events.find((event) => event.name === FLOW_GROUP);
  const found = [];
  const walk = (events) => {
    for (const event of events) {
      for (const action of event.actions || []) {
        if (action.type && action.type.value === 'StringVariable') found.push(action.parameters);
      }
      for (const action of event.actions || []) {
        if (action.type && action.type.value === 'SetStringVariable') found.push(action.parameters);
      }
      if (event.events) walk(event.events);
    }
  };
  walk(group.events);
  return found;
};

test('the match flow names its two native endings', () => {
  const written = nativeEndings().map((parameters) => parameters.join(' '));
  assert.ok(written.some((line) => line.startsWith('WinWinner = "wolf"')), 'all frozen writes the winner');
  assert.ok(written.some((line) => line.startsWith('WinReason = "frozen"')), 'all frozen writes the reason');
  assert.ok(written.some((line) => line.startsWith('WinWinner = "human"')), 'time up writes the winner');
  assert.ok(written.some((line) => line.startsWith('WinReason = "time"')), 'time up writes the reason');
});

test('the scripted endings write their own winner and reason', () => {
  const counter = groupCodeAll('v0.6.5 Survivor/Frozen counter + Wolf role pick');
  assert.match(counter, /setString\('wolf'\);\n\s*vars\.get\('WinReason'\)\.setString\('frozen'\)/,
    'the survivor counter writes the wolves\' win');

  const arena = groupCode('v0.7.0 2階・階段・5スイッチ・3ゲート');
  assert.match(arena, /setString\('human'\);\n\s*vars\.get\('WinReason'\)\.setString\('gate'\)/,
    'the gate escape writes the humans\' win');

  const sync = groupCode('v1.1.0 オンライン対戦同期');
  assert.match(sync, /vars\.get\('WinWinner'\)\.setString\(winId === 'wolf' \? 'wolf' : 'human'\)/,
    'a guest follows the host\'s ending');
  assert.match(sync, /vars\.get\('WinReason'\)\.setString\(winBy === 'gate' \? 'gate'/,
    'a guest follows the host\'s reason');
});

test('a new round starts with no ending at all', () => {
  const menu = groupCode(MENU_GROUP);
  const reset = menu.indexOf('const resetRound = (forcedRole');
  const body = menu.slice(reset, menu.indexOf('const safeStorageGet'));
  assert.match(body, /vars\.get\('WinWinner'\)\.setString\(''\)/, 'the winner is cleared');
  assert.match(body, /vars\.get\('WinReason'\)\.setString\(''\)/, 'the reason is cleared');
});

/* ------------------------------------------- 4. the readers use the ending model */
test('the panel, the record, the sound and the host read the ending model', () => {
  const menu = groupCode(MENU_GROUP);
  const panel = menu.indexOf("currentPhase === 'Result') {");
  assert.ok(panel > 0, 'the result panel is still there');
  assert.match(menu, /const ending = iceWolfEndingCopy\(tr, vars, sourceText\);/, 'the panel asks the model');
  assert.doesNotMatch(menu, /sourceText\.indexOf\('人狼'\)/, 'the panel no longer sniffs the line');

  const record = menu.indexOf('if (currentPhase === \'Result\' && !vars.get');
  const recordBody = menu.slice(record, record + 800);
  assert.match(recordBody, /const winner = iceWolfWinWinner\(vars, resultText\);/, 'the record asks the model');

  const sound = groupCodeAll('v0.6.9 サウンドエンジン + サウンド設定');
  assert.match(sound, /__iceWolfV111Ending/, 'the sound cue asks the model');

  const online = groupCodeAll('v1.1.0 オンライン中核');
  assert.match(online, /endingApi\.winner\(vars, winTextNow\)/, 'the host sends the model\'s winner');
  assert.match(online, /endingApi\.reason\(vars, winIdNow, winTextNow\)/, 'the host sends the model\'s reason');
});

/* ------------------------------------ 5. the feedback line keeps its own clock
 * The spaceship recording: the trap warning ("⚠️ 罠！「D」は3人目の人狼になった！")
 * stayed on the screen for the rest of the round. The v0.3 group hides the line
 * when FeedbackLeft runs out, but the menu group re-showed it every frame. */
test('a feedback line is never re-shown after its clock runs out', () => {
  const menu = groupCode(MENU_GROUP);
  assert.doesNotMatch(menu,
    /for \(const hudName of \['RoleText', 'StatusText', 'BuildText', 'ActionFeedbackText', 'WinText'\]\)/,
    'the blanket show no longer includes the feedback line');
  const line = /setObjVisible\('ActionFeedbackText', [^\n]*\);/.exec(menu);
  assert.ok(line, 'the feedback line has a visibility line of its own');

  /* Run the shipped line: it is the one that decides whether the last warning
   * of a round stays on the screen. */
  const shown = (feedbackLeft, playing) => {
    const context = vm.createContext({});
    vm.runInContext(`(function(){
      const activeForUi = ${playing ? 'true' : 'false'};
      const setObjVisible = (name, visible) => { globalThis.__shown = { name: name, visible: visible }; };
      const vars = { get: () => ({ getAsNumber: () => ${feedbackLeft} }) };
      ${line[0]}
    })();`, context);
    return context.__shown;
  };
  assert.equal(shown(2.4, true).name, 'ActionFeedbackText', 'a fresh warning is shown');
  assert.equal(shown(2.4, true).visible, true, 'a fresh warning is shown');
  assert.equal(shown(0, true).visible, false, 'the warning goes away when its clock runs out');
  assert.equal(shown(0.4, true).visible, true, 'and stays while it still has time');
  assert.equal(shown(2.4, false).visible, false, 'nothing is shown outside a round');

  /* The clock itself is still the v0.3 group's, and still hides at zero. */
  const clarity = JSON.stringify(sceneOf(readGame()).events.find((event) => event.name === 'v0.3 Action clarity feedback'));
  assert.ok(clarity.includes('FeedbackLeft'), 'the countdown still owns the line');
  assert.ok(clarity.includes('Hide'), 'and still hides it');
});

/* A guard against a new ending site that forgets the two variables. */
test('no ending sets a win line without naming the ending', () => {
  const code = fs.readFileSync(new URL('./../../game.json', import.meta.url), 'utf8');
  const data = JSON.parse(code);
  const scene = data.layouts.find((layout) => layout.name === 'FROST LAB');
  const offenders = [];
  const walk = (events) => {
    for (const event of events) {
      const text = Array.isArray(event.inlineCode) ? event.inlineCode.join('\n') : event.inlineCode || '';
      const writesWinLine = /setString\('(人狼の勝利|人間の勝利)'\)/.test(text);
      const namesEnding = text.includes("setString('WinWinner')") || text.includes('WinWinner');
      if (writesWinLine && !namesEnding) offenders.push(text.slice(0, 60));
      for (const action of event.actions || []) {
        const line = JSON.stringify(action.parameters || []);
        if (action.type && action.type.value === 'TextContainerCapability::TextContainerBehavior::SetValue'
          && (line.includes('人狼の勝利') || line.includes('人間の勝利'))) {
          const next = (event.actions || []).map((item) => JSON.stringify(item.parameters || [])).join(' ');
          if (!next.includes('WinWinner')) offenders.push(`native: ${line}`);
        }
      }
      if (event.events) walk(event.events);
    }
  };
  walk(scene.events);
  assert.deepEqual(offenders, [], 'every ending names its winner and reason');
});
