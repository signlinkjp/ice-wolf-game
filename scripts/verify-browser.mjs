/**
 * Real-browser verification of the built www/ — the build's acceptance test.
 *
 *   node scripts/verify-browser.mjs
 *
 * It opens the actual built game in Chromium (SwiftShader WebGL) with a
 * Japanese phone profile (locale ja-JP, Asia/Tokyo), plays each of the six
 * stages, drives the controls with real pointer events, checks the Build 38
 * systems one by one (Japanese launch, opening, two halls, stair and warp
 * zones, master wolf, contact freeze, switch signs, camera occlusion, the
 * classroom lockdown) and saves representative screenshots to downloads/.
 *
 * Exit code 0 = every check passed.
 */
import { createRequire } from 'node:module';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const PLAYWRIGHT_DIR = process.env.PLAYWRIGHT_DIR || '/workspace/work/dcd-b17/';
const BROWSERS = process.env.PLAYWRIGHT_BROWSERS_PATH || '/workspace/work/dcd-b17/browsers';
const LIB_DIR = process.env.BROWSER_LIBS || path.join(ROOT, '.browser-libs/usr/lib/x86_64-linux-gnu');
process.env.PLAYWRIGHT_BROWSERS_PATH = BROWSERS;
process.env.LD_LIBRARY_PATH = [LIB_DIR, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');

const require = createRequire(PLAYWRIGHT_DIR);
const { chromium } = require('playwright');
const { startServer } = await import('./serve.mjs');

const OUT = process.env.SHOT_DIR || '/workspace/downloads';
const PORT = Number(process.env.PORT || 8951);
const STAGES = ['classic', 'aquarium', 'park', 'lodge', 'school', 'space'];
const results = [];

function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? '  PASS' : '  FAIL'}  ${name}${detail && !condition ? `  (${detail})` : ''}`);
}

const errors = [];
const server = await startServer(PORT);
const browser = await chromium.launch({
  executablePath: path.join(BROWSERS, 'chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'),
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 900, height: 600 },
  deviceScaleFactor: 1,
  locale: 'ja-JP',
  timezoneId: 'Asia/Tokyo',
});
await context.addInitScript(() => {
  // Record when the opening appears and disappears. The first launch builds the
  // scene during page load, so a post-load probe can arrive after a 3 s title
  // has already played.
  window.__openingLog = { shown: null, hidden: null, menu: null };
  const attach = () => {
    const opening = document.getElementById('opening');
    const menu = document.getElementById('menu');
    if (!opening || !menu) {
      setTimeout(attach, 30);
      return;
    }
    const note = () => {
      const t = performance.now();
      if (!opening.classList.contains('hidden') && window.__openingLog.shown === null) window.__openingLog.shown = t;
      if (opening.classList.contains('hidden') && window.__openingLog.shown !== null && window.__openingLog.hidden === null) window.__openingLog.hidden = t;
      if (!menu.classList.contains('hidden') && window.__openingLog.menu === null) window.__openingLog.menu = t;
    };
    note();
    new MutationObserver(note).observe(opening, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(note).observe(menu, { attributes: true, attributeFilter: ['class'] });
  };
  attach();
});

const page = await context.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

await mkdir(OUT, { recursive: true });
const shot = async (name) => {
  const file = path.join(OUT, `icewolf-b38-${name}.png`);
  try {
    await page.screenshot({ path: file, timeout: 25000 });
  } catch {
    // SwiftShader can stall a frame; one retry is enough.
    await page.waitForTimeout(600);
    await page.screenshot({ path: file, timeout: 25000 });
  }
  const s = await stat(file);
  check(`screenshot ${name} rendered (>40KB)`, s.size > 40000, `${s.size}B`);
  return file;
};

const wait = (ms) => page.waitForTimeout(ms);

async function overflow(selector) {
  return page.evaluate((sel) => {
    const out = [];
    for (const el of document.querySelectorAll(sel)) {
      if (el.offsetParent === null) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.left < -2 || r.right > window.innerWidth + 2) {
        out.push({ why: 'horizontal', text: (el.textContent || '').trim().slice(0, 30), r: [r.left, r.top, r.right, r.bottom] });
        continue;
      }
      const style = getComputedStyle(el);
      const clips = style.overflow !== 'visible' || style.textOverflow === 'ellipsis';
      if (!clips && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        out.push({ why: 'text', text: (el.textContent || '').trim().slice(0, 30), r: [r.left, r.top, r.right, r.bottom] });
      }
    }
    return out;
  }, selector);
}

const startPlay = async (stageId) => page.evaluate((id) => {
  const app = window.iceWolf;
  app.chooseStage(id);
  app.startMatch({});
  app.phase = 'play';
  app.ui.hideBrief();
  app.ui.showCountdown(0);
}, stageId);

/* ------------------------------------------------------------------ */
console.log('\n== 1. launch: Japanese first, opening, home ==');
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__openingLog && window.__openingLog.hidden !== null, null, { timeout: 60000 }).catch(() => {});
const openingLog = await page.evaluate(() => window.__openingLog);
check('opening animation plays on launch', openingLog.shown !== null, JSON.stringify(openingLog));
const openingMs = openingLog.shown !== null && openingLog.hidden !== null ? Math.round(openingLog.hidden - openingLog.shown) : 0;
check('opening is a real title sequence (2.5-4 s)', openingMs >= 2400 && openingMs <= 4400, `${openingMs} ms`);
check('home screen is visible after the opening', await page.locator('#menu').isVisible());
await shot('home-ja');

// Capture the title itself: replay it, pin the animation clock at 1.9 s (a slow
// software renderer can take longer than the whole sequence to take a shot) and
// grab the frame.
await page.evaluate(() => {
  const app = window.iceWolf;
  app.__realSkip = app.skipOpening.bind(app);
  app.skipOpening = () => {};
  app.playOpening();
  window.__holdT = 1.9;
  const hold = () => {
    if (app.view.opening) app.view.opening.t0 = performance.now() - window.__holdT * 1000;
    requestAnimationFrame(hold);
  };
  hold();
});
// The CSS title runs on the wall clock (delay 1.45 s), the 3D is pinned at
// 1.9 s, so wait past the title's entrance before the shot.
await wait(2600);
const openingShotState = await page.evaluate(() => ({
  visible: !document.getElementById('opening').classList.contains('hidden'),
  t: Math.round(window.iceWolf.view.opening.t * 10) / 10,
}));
await shot('opening');
check('the opening frame was captured mid-sequence', openingShotState.visible && openingShotState.t > 0.5, JSON.stringify(openingShotState));
await page.evaluate(() => {
  const app = window.iceWolf;
  app.skipOpening = app.__realSkip;
  app.phase = 'opening';
  app.skipOpening();
});
await wait(400);
const homeText = await page.locator('#menu').innerText();
check('Japanese phone opens in Japanese', /ゲームスタート/.test(homeText), homeText.slice(0, 60));
check('document lang is ja', await page.evaluate(() => document.documentElement.lang) === 'ja');
await shot('home-ja');

// A saved "en" from an older build must not pin the app to English any more.
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('iceWolfSettingsV2', JSON.stringify({ language: 'en' }));
  localStorage.setItem('iceWolfLanguage', 'en');
});
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__openingLog && window.__openingLog.shown !== null, null, { timeout: 20000 }).catch(() => {});
const openingVisible2 = await page.locator('#opening').isVisible();
check('opening replays on the next launch', openingVisible2);
if (openingVisible2) {
  // A tap at a point where only the opening overlay is under the finger.
  const hit = await page.evaluate(() => (document.elementFromPoint(450, 300) || {}).closest?.('#opening') !== null);
  await page.mouse.click(450, 300);
  const phaseSkipped = await page.waitForFunction(() => window.iceWolf.phase === 'menu', null, { timeout: 8000 }).then(() => true).catch(() => false);
  const menuShown = await page.waitForFunction(() => !document.getElementById('menu').classList.contains('hidden'), null, { timeout: 8000 }).then(() => true).catch(() => false);
  check('a tap anywhere skips the opening', hit && phaseSkipped && menuShown, JSON.stringify({ hit, phaseSkipped, menuShown }));
}
const staleText = await page.locator('#menu').innerText();
check('a stale saved "en" no longer forces English', /ゲームスタート/.test(staleText), staleText.slice(0, 60));

// A language the player picked IS kept.
await page.evaluate(() => window.iceWolf.changeLanguage('en'));
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__openingLog && window.__openingLog.shown !== null, null, { timeout: 30000 }).catch(() => {});
await page.mouse.click(450, 300);
await page.waitForFunction(() => !document.getElementById('menu').classList.contains('hidden'), null, { timeout: 6000 }).catch(() => {});
await wait(300);
const chosenText = await page.locator('#menu').innerText();
check('a language chosen in settings is kept', /START GAME/.test(chosenText), chosenText.slice(0, 60));
await page.evaluate(() => window.iceWolf.changeLanguage('ja'));
await wait(300);

/* home stays light: sample the top-left pixel of the panel */
const homeBrightness = await page.evaluate(() => getComputedStyle(document.querySelector('.menu-left')).backgroundColor);
check('home panel is light (no dark background)', /rgba\(255, 255, 255|rgb\(255, 255, 255/.test(homeBrightness), homeBrightness);

console.log('\n== 2. sheets ==');
for (const [btn, name] of [['#settingsBtnMenu', 'settings'], ['#stageBtn', 'stages'], ['#howBtn', 'how'], ['#proBtn', 'pro'], ['#onlineBtn', 'online'], ['#recordBtn', 'record']]) {
  await page.click(btn);
  await wait(320);
  check(`${name} sheet opens`, await page.locator('#sheet').isVisible());
  await shot(`sheet-${name}`);
  await page.click('#sheetClose');
  await wait(150);
}

console.log('\n== 3. six stages: two halls, signs, ambience ==');
await page.evaluate(() => { window.iceWolf.pro = true; window.iceWolf.ui.setPro(true); window.iceWolf.changeSettings({ players: 10, wolves: 2, switches: 5, correct: 3 }); });
for (const id of STAGES) {
  await page.evaluate((stageId) => {
    const app = window.iceWolf;
    app.chooseStage(stageId);
    app.startMatch({});
    app.phase = 'play';
    app.ui.hideBrief();
    app.ui.showCountdown(0);
    const p = app.match.actors[0];
    const spawn = app.match.stage.playerSpawn;
    p.x = spawn.x; p.z = spawn.z; p.floor = 1; p.y = 0;
    app.view.cameraPos.set(spawn.x, 12, spawn.z + 9.2);
  }, id);
  await wait(1000);
  const info = await page.evaluate(() => {
    const app = window.iceWolf;
    const m = app.match;
    const sv = app.view.stageView;
    const labelKeys = (sv.labels || []).map((l) => l.key);
    return {
      stage: m.stage.id,
      actors: m.actors.length,
      switches: m.switches.length,
      gates: m.gates.length,
      floor2: m.actors.filter((a) => a.floor === 2).length,
      hall1: m.stage.floors[1].length,
      hall2: m.stage.floors[2].length,
      stairs: m.stage.stairs.length,
      warps: m.stage.warps.length,
      switchSigns: labelKeys.filter((k) => k === 'sign.switch').length,
      stairSigns: labelKeys.filter((k) => k === 'sign.stairs').length,
      warpSigns: labelKeys.filter((k) => k === 'sign.warp').length,
      hallSigns: labelKeys.filter((k) => k === 'sign.hall').length,
      ambience: sv.ambience ? sv.ambience.group.children.length : 0,
      occluders: sv.occluders.length,
      gimmick: m.stage.gimmick ? m.stage.gimmick.kind : null,
      triangles: app.view.renderer.info.render.triangles,
      drawing: app.view.renderer.info.render.calls,
    };
  });
  check(`${id}: 10 actors, switches and 3 gates`, info.actors === 10 && info.switches >= 3 && info.gates === 3, JSON.stringify(info));
  check(`${id}: two separate halls and CPU spawns on both floors`, info.hall1 === 1 && info.hall2 === 1 && info.floor2 > 0, JSON.stringify(info));
  check(`${id}: 4 stair zones and 4 warp mouths`, info.stairs === 4 && info.warps === 4);
  check(`${id}: every switch carries a sign`, info.switchSigns >= info.switches && info.stairSigns === 4 && info.warpSigns === 4 && info.hallSigns === 2, JSON.stringify(info));
  check(`${id}: its own ambience set is on stage`, info.ambience >= 3 && info.gimmick !== null, `${info.ambience} objects`);
  check(`${id}: scene has meshes`, info.triangles > 2000, `${info.triangles} tris`);
  await shot(`stage-${id}`);
}

/* a 2F shot: the camera must follow the player's hall */
await page.evaluate(() => {
  const app = window.iceWolf;
  app.chooseStage('classic');
  app.startMatch({});
  app.phase = 'play';
  app.ui.hideBrief();
  app.ui.showCountdown(0);
  const m = app.match;
  const p = m.actors[0];
  p.floor = 2;
  p.x = 28; p.z = -4; p.y = 0;
  for (const a of m.actors) {
    if (a.seat === 0) continue;
    a.isCPU = false;
    a.state = 'active';
    a.floor = 2;
    a.x = 20 + a.seat * 2;
    a.z = 4;
  }
  app.view.cameraPos.set(28, 12, 4 + 9.2);
  app.view.updateCamera(m, 0.5, 'normal');
});
await wait(900);
const twoFView = await page.evaluate(() => ({
  camX: Math.round(window.iceWolf.view.camera.position.x),
  floorBtn: document.getElementById('floorBtn').textContent,
}));
check('on 2F the camera sits over the 2F hall', twoFView.camX > 4 && twoFView.floorBtn === '2F', JSON.stringify(twoFView));
await shot('stage-classic-2f');

console.log('\n== 4. stair and warp zones ==');
// A calm arena: nobody frozen, no match already decided by an earlier test.
const calmMatch = (id) => page.evaluate((stageId) => {
  const app = window.iceWolf;
  app.chooseStage(stageId);
  app.startMatch({});
  app.phase = 'play';
  app.ui.hideBrief();
  app.ui.showCountdown(0);
  const m = app.match;
  m.phase = 'play';
  m.win = null;
  for (const a of m.actors) {
    a.state = 'active';
    a.frozenType = null;
    a.role = 'human';
    a.form = 'human';
    a.wolfTimer = 0;
    a.isCPU = false;
  }
}, id);
await calmMatch('classic');
await wait(300);
const stairHop = await page.evaluate(async () => {
  const app = window.iceWolf;
  const m = app.match;
  const p = m.actors[0];
  const stair = m.stage.stairs.find((s) => s.floor === 1);
  p.state = 'active';
  p.frozenType = null;
  p.stairLock = 0;
  p.floor = 1;
  p.x = stair.x;
  p.z = stair.z;
  await new Promise((r) => setTimeout(r, 500));
  return {
    floor: p.floor,
    expect: stair.toFloor,
    x: p.x,
    z: p.z,
    exitX: stair.exitX,
    exitZ: stair.exitZ,
    state: p.state,
    lock: Math.round(p.stairLock * 100) / 100,
    matchPhase: m.phase,
    appPhase: app.phase,
  };
});
check('a stair zone carries the player to the other hall', stairHop.floor === stairHop.expect && Math.hypot(stairHop.x - stairHop.exitX, stairHop.z - stairHop.exitZ) < 0.3, JSON.stringify(stairHop));
await shot('stair-zone');

await calmMatch('classic');
await wait(250);
const warpHop = await page.evaluate(async () => {
  const app = window.iceWolf;
  const m = app.match;
  const p = m.actors[0];
  const warp = m.stage.warps.find((w) => w.floor === p.floor) || m.stage.warps[0];
  p.state = 'active';
  p.frozenType = null;
  p.floor = warp.floor;
  p.warpCooldown = 0;
  p.x = warp.x;
  p.z = warp.z;
  await new Promise((r) => setTimeout(r, 350));
  return { floor: p.floor, expect: warp.floor, x: p.x, z: p.z, toX: warp.toX, toZ: warp.toZ };
});
check('a warp crosses its own floor only', warpHop.floor === warpHop.expect && Math.hypot(warpHop.x - warpHop.toX, warpHop.z - warpHop.toZ) < 0.3, JSON.stringify(warpHop));

console.log('\n== 5. master wolf: always a wolf, freezes on touch ==');
const master = await page.evaluate(async () => {
  const app = window.iceWolf;
  app.chooseStage('classic');
  app.startMatch({});
  app.phase = 'play';
  app.ui.hideBrief();
  app.ui.showCountdown(0);
  const m = app.match;
  const p = m.actors[0];
  p.role = 'firstWolf';
  p.form = 'wolf';
  p.state = 'active';
  p.wolfTimer = 0;
  p.wolfCooldown = 0;
  p.floor = 1;
  p.x = -20; p.z = 0;
  app.phase = 'play';
  const human = m.actors.find((a) => a.seat !== 0);
  for (const a of m.actors) if (a.seat !== 0) { a.isCPU = false; a.role = 'human'; a.state = 'active'; a.form = 'human'; a.floor = 1; a.x = 40; a.z = 15; }
  human.x = -19.2;
  human.z = 0;
  human.floor = 1;
  app.updateHud();
  const before = { wolfTimer: p.wolfTimer, state: human.state };
  await new Promise((r) => setTimeout(r, 400));
  return {
    before,
    after: human.state,
    wolfTimer: p.wolfTimer,
    form: p.form,
    wolfBtnHidden: document.getElementById('wolfBtn').classList.contains('hidden'),
    infectHidden: document.getElementById('infectBtn').classList.contains('hidden'),
    hint: document.getElementById('hintBar').textContent,
    roleLabel: document.getElementById('roleText').textContent,
    wolfBodyVisible: app.view.actors.get(0).wolf.visible,
  };
});
check('master wolf freezes a human just by touching it', master.before.state === 'active' && master.after === 'frozen', JSON.stringify(master));
check('master wolf needs no Wolf Mode button', master.wolfTimer === 0 && master.wolfBtnHidden && master.form === 'wolf', JSON.stringify(master));
check('master wolf wears the wolf body all match', master.wolfBodyVisible === true);
check('master wolf hint says it is always a wolf', /マスター鬼|ずっと鬼/.test(master.hint), master.hint);
check('master wolf can still name trap ice', master.infectHidden === false);
await page.evaluate(() => {
  const app = window.iceWolf;
  const p = app.match.actors[0];
  app.view.cameraPos.set(p.x, 11.8, p.z + 9.2);
  app.view.camera.position.copy(app.view.cameraPos);
  app.view.cameraLook.set(p.x, 1.2, p.z);
  app.view.camera.lookAt(app.view.cameraLook);
});
await wait(500);
await shot('master-wolf');

const werewolf = await page.evaluate(async () => {
  const app = window.iceWolf;
  const m = app.match;
  const p = m.actors[0];
  app.phase = 'play';
  p.role = 'werewolf';
  p.form = 'human';
  p.wolfTimer = 0;
  p.wolfCooldown = 0;
  app.updateHud();
  const btn = document.getElementById('wolfBtn');
  const visible = !btn.classList.contains('hidden');
  const wolfBodyHidden = !app.view.actors.get(0).wolf.visible;
  await new Promise((r) => setTimeout(r, 700));
  return { visible, wolfBodyHidden: !app.view.actors.get(0).wolf.visible, label: document.getElementById('wolfLabel').textContent };
});
check('a werewolf still has the transform button and a human body', werewolf.visible && werewolf.wolfBodyHidden, JSON.stringify(werewolf));

console.log('\n== 6. controls: stick, buttons, rescue, switch ==');
const calmScene = () => page.evaluate(() => {
  const app = window.iceWolf;
  app.changeSettings({ players: 7, wolves: 1, switches: 5, correct: 3, controls: 'stick' });
  app.startMatch({});
  app.phase = 'play';
  app.ui.hideBrief();
  app.ui.showCountdown(0);
  const m = app.match;
  for (const a of m.actors) {
    a.role = 'human';
    a.form = 'human';
    a.state = 'active';
    a.wolfTimer = 0;
    a.wolfCooldown = 1;
  }
  const p = m.actors[0];
  p.x = -12; p.z = 6; p.floor = 1; p.y = 0;
});
await calmScene();
await wait(400);
const before = await page.evaluate(() => { const p = window.iceWolf.match.actors[0]; return { x: p.x, z: p.z }; });
const stick = await page.locator('#stick').boundingBox();
await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2);
await page.mouse.down();
await page.mouse.move(stick.x + stick.width / 2 + 46, stick.y + stick.height / 2, { steps: 6 });
await wait(1100);
await page.mouse.up();
await wait(200);
const after = await page.evaluate(() => { const p = window.iceWolf.match.actors[0]; return { x: p.x, z: p.z }; });
check('fixed stick moves the player', Math.hypot(after.x - before.x, after.z - before.z) > 0.9, `${JSON.stringify(before)} -> ${JSON.stringify(after)}`);

const posA = await page.evaluate(() => { const p = window.iceWolf.match.actors[0]; return { x: p.x, z: p.z }; });
const actionBox = await page.locator('#actionBtn').boundingBox();
await page.mouse.move(actionBox.x + actionBox.width / 2, actionBox.y + actionBox.height / 2);
await page.mouse.down();
await wait(120);
await page.mouse.up();
await wait(250);
const posB = await page.evaluate(() => { const p = window.iceWolf.match.actors[0]; return { x: p.x, z: p.z }; });
check('buttons never swallow movement', Math.hypot(posB.x - posA.x, posB.z - posA.z) < 0.6, `${JSON.stringify(posA)} -> ${JSON.stringify(posB)}`);

// Rescue.
await calmScene();
await wait(200);
await page.evaluate(() => {
  const app = window.iceWolf;
  const m = app.match;
  const p = m.actors[0];
  const cpu = m.actors.find((a) => a.seat !== 0);
  cpu.state = 'frozen';
  cpu.frozenType = 'human';
  cpu.frozenX = p.x + 1.2;
  cpu.frozenZ = p.z;
  cpu.frozenFloor = p.floor;
  cpu.x = p.x + 1.2;
  cpu.z = p.z;
  cpu.floor = p.floor;
  app.__rescueSeat = cpu.seat;
});
const ab = await page.locator('#actionBtn').boundingBox();
await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2);
await page.mouse.down();
await wait(150);
check('holding the action button registers', await page.evaluate(() => window.iceWolf.hold.action === true));
const rescueSeat = await page.evaluate(() => window.iceWolf.__rescueSeat);
await page.waitForFunction(
  (seat) => window.iceWolf.match.actors.find((a) => a.seat === seat).state === 'active',
  rescueSeat,
  { timeout: 20000 },
).catch(() => {});
const rescueState = await page.evaluate((seat) => window.iceWolf.match.actors.find((a) => a.seat === seat).state, rescueSeat);
await page.mouse.up();
check('holding RESCUE 1.5 s thaws a frozen teammate', rescueState === 'active', rescueState);

// Switch.
await calmScene();
await wait(200);
await page.evaluate(() => {
  const app = window.iceWolf;
  const m = app.match;
  const p = m.actors[0];
  const sw = m.switches.find((s) => s.correct && !s.active);
  p.x = sw.x; p.z = sw.z; p.floor = sw.floor; p.y = 0;
  for (const a of m.actors) if (a.seat !== 0) a.isCPU = false;
  app.__switchId = sw.id;
});
await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2);
await page.mouse.down();
const switchId = await page.evaluate(() => window.iceWolf.__switchId);
await page.waitForFunction((id) => window.iceWolf.match.switches[id].active, switchId, { timeout: 20000 }).catch(() => {});
const switchOn = await page.evaluate((id) => window.iceWolf.match.switches[id].active, switchId);
await page.mouse.up();
check('holding the action button 1.9 s turns a switch on', switchOn);
await shot('switch-held');

// Camera toggle.
await page.click('#camBtn');
await wait(500);
check('CAM switches to the overhead view', await page.evaluate(() => window.iceWolf.settings.camera) === 'top');
await page.click('#camBtn');
await wait(250);

// Touch controls.
await calmScene();
await page.evaluate(() => {
  const app = window.iceWolf;
  app.changeSettings({ controls: 'touch' });
  const p = app.match.actors[0];
  p.x = -14; p.z = 4; p.floor = 1; p.y = 0;
});
await wait(250);
const t0 = await page.evaluate(() => { const p = window.iceWolf.match.actors[0]; return { x: p.x, z: p.z }; });
await page.mouse.move(420, 380);
await page.mouse.down();
await page.mouse.move(420, 300, { steps: 6 });
await wait(1100);
await page.mouse.up();
await wait(200);
const t1 = await page.evaluate(() => { const p = window.iceWolf.match.actors[0]; return { x: p.x, z: p.z }; });
check('drag anywhere moves the player', Math.hypot(t1.x - t0.x, t1.z - t0.z) > 0.6, `${JSON.stringify(t0)} -> ${JSON.stringify(t1)}`);
await page.evaluate(() => window.iceWolf.changeSettings({ controls: 'stick' }));

console.log('\n== 7. camera: tall walls fade instead of hiding the player ==');
const occlusion = await page.evaluate(async () => {
  const app = window.iceWolf;
  app.chooseStage('classic');
  app.startMatch({});
  app.phase = 'play';
  app.ui.hideBrief();
  app.ui.showCountdown(0);
  const m = app.match;
  const p = m.actors[0];
  for (const a of m.actors) if (a.seat !== 0) { a.isCPU = false; a.x = 40; a.z = 15; a.floor = 2; }
  // Stand right against the south outer wall, camera behind (outside) it.
  p.floor = 1;
  p.x = -30; p.z = 19.1;
  app.view.cameraPos.set(-30, 11.8, 28.3);
  app.view.camera.position.copy(app.view.cameraPos);
  for (let i = 0; i < 40; i += 1) app.view.updateCamera(m, 0.05, 'normal');
  const faded = app.view.stageView.occluders.filter((o) => o.solid.fade < 0.9).length;
  const lift = app.view.camLift;
  return { faded, occluders: app.view.stageView.occluders.length, lift };
});
check('a wall between camera and player turns translucent', occlusion.faded > 0, JSON.stringify(occlusion));
check('tall walls are registered as camera occluders', occlusion.occluders >= 5, String(occlusion.occluders));

console.log('\n== 8. school: the classroom door really closes ==');
const school = await page.evaluate(async () => {
  const app = window.iceWolf;
  app.chooseStage('school');
  app.startMatch({});
  app.phase = 'play';
  app.ui.hideBrief();
  app.ui.showCountdown(0);
  const m = app.match;
  const door = m.stage.gimmick.doors[0];
  const shutter = app.view.stageView.shutters[0];
  for (const a of m.actors) if (a.seat !== 0) { a.isCPU = false; a.x = 40; a.z = 15; a.floor = 2; }
  const p = m.actors[0];
  // Jump to the middle of the shutter window, then let the door fall.
  const cycle = m.stage.gimmick.cycle;
  m.elapsed = cycle.period + cycle.chime + 0.3;
  await new Promise((r) => setTimeout(r, 2200));
  const duringShut = { visible: shutter.mesh.visible, y: Math.round(shutter.mesh.position.y * 10) / 10 };
  // Stand in the doorway: the shutter must push the body out.
  p.floor = door.floor;
  p.x = door.x;
  p.z = door.z;
  await new Promise((r) => setTimeout(r, 400));
  const pushed = Math.abs(p.z - door.z) > door.d / 2;
  return { duringShut, pushed, pz: Math.round(p.z * 10) / 10, doorZ: door.z };
});
check('the shutter is physically down during the lockdown', school.duringShut.visible && school.duringShut.y < 1.9, JSON.stringify(school));
check('standing in a closed doorway pushes the body out', school.pushed, JSON.stringify(school));
await page.evaluate(() => {
  const app = window.iceWolf;
  const p = app.match.actors[0];
  app.view.cameraPos.set(p.x, 11.8, p.z + 9.2);
  app.view.camera.position.copy(app.view.cameraPos);
  app.view.cameraLook.set(p.x, 1.2, p.z);
});
await wait(400);
await shot('school-lockdown');
const tallFade = await page.evaluate(() => {
  const app = window.iceWolf;
  app.chooseStage('park');
  app.startMatch({});
  app.phase = 'play';
  app.ui.hideBrief();
  app.ui.showCountdown(0);
  const m = app.match;
  const p = m.actors[0];
  for (const a of m.actors) if (a.seat !== 0) { a.isCPU = false; a.state = 'active'; a.x = 40; a.z = 10; a.floor = 2; }
  p.state = 'active';
  p.frozenType = null;
  // Behind the 9 m ferris wheel: the wheel must fade, not fill the frame.
  const ferris = m.stage.props.find((pr) => pr.type === 'ferris' && pr.floor === 2);
  p.floor = 2;
  p.x = ferris.x;
  p.z = -19;
  app.view.cameraPos.set(p.x, 11.8, p.z + 9.2);
  app.view.camera.position.copy(app.view.cameraPos);
  for (let i = 0; i < 40; i += 1) app.view.updateCamera(m, 0.05, 'normal');
  const faded = app.view.stageView.occluders.filter((o) => o.solid.fade < 0.9).length;
  return { faded, lift: Math.round(app.view.camLift * 10) / 10, ferris: { x: ferris.x, z: ferris.z } };
});
check('a tall prop between camera and player turns translucent', tallFade.faded > 0, JSON.stringify(tallFade));
check('the camera also lifts near tall props', tallFade.lift > 0.3, JSON.stringify(tallFade));

console.log('\n== 9. frozen camera ==');
await calmScene();
await wait(200);
const frozenInfo = await page.evaluate(async () => {
  const app = window.iceWolf;
  const m = app.match;
  const p = m.actors[0];
  for (const a of m.actors) {
    if (a.seat === 0) continue;
    a.role = 'human';
    a.state = 'active';
    a.isCPU = false;
    a.floor = 2;
    a.x = 40;
    a.z = -12 + a.seat * 2;
  }
  p.state = 'frozen';
  p.frozenType = 'human';
  p.frozenX = p.x;
  p.frozenZ = p.z;
  p.frozenFloor = p.floor;
  m.spectateSeat = null;
  await new Promise((r) => setTimeout(r, 700));
  app.view.frozenPan.x = 0;
  app.view.frozenPan.z = 0;
  const focus = app.view.focusPoint(m);
  return {
    spectateSeat: m.spectateSeat,
    focusX: Math.round(focus.x * 10) / 10,
    focusZ: Math.round(focus.z * 10) / 10,
    px: Math.round(p.frozenX * 10) / 10,
    pz: Math.round(p.frozenZ * 10) / 10,
    overhead: app.view.camera.position.y > 10,
    specText: (document.getElementById('specText').textContent || '').trim(),
  };
});
check('frozen: no automatic switch to another character', frozenInfo.spectateSeat === null, JSON.stringify(frozenInfo));
check('frozen: camera stays on the player', Math.abs(frozenInfo.focusX - frozenInfo.px) < 0.5 && Math.abs(frozenInfo.focusZ - frozenInfo.pz) < 0.5, JSON.stringify(frozenInfo));
check('frozen: bar shows the camera hint', frozenInfo.specText.length > 0, frozenInfo.specText);

const posBefore = await page.evaluate(() => {
  const p = window.iceWolf.match.actors[0];
  return { x: p.frozenX, z: p.frozenZ, pan: { ...window.iceWolf.view.frozenPan } };
});
await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2);
await page.mouse.down();
await page.mouse.move(stick.x + stick.width / 2 + 46, stick.y + stick.height / 2, { steps: 6 });
await wait(900);
await page.mouse.up();
await wait(200);
const posAfter = await page.evaluate(() => {
  const app = window.iceWolf;
  const p = app.match.actors[0];
  return { x: p.frozenX, z: p.frozenZ, pan: { ...app.view.frozenPan } };
});
check('frozen: the stick does not move the frozen body', Math.hypot(posAfter.x - posBefore.x, posAfter.z - posBefore.z) < 0.01);
check('frozen: the stick pans the camera focus', Math.abs(posAfter.pan.x - posBefore.pan.x) > 1.5, `pan ${posBefore.pan.x} -> ${posAfter.pan.x}`);
await shot('frozen-camera-panned');

await page.click('#camBtn');
await wait(400);
const recentred = await page.evaluate(() => {
  const app = window.iceWolf;
  const p = app.match.actors[0];
  const focus = app.view.focusPoint(app.match);
  return { dx: Math.abs(focus.x - p.frozenX), dz: Math.abs(focus.z - p.frozenZ) };
});
check('frozen: CAM returns the camera to the player', recentred.dx < 0.4 && recentred.dz < 0.4, JSON.stringify(recentred));

/* the floor button looks at the other hall */
await page.evaluate(() => {
  const app = window.iceWolf;
  const p = app.match.actors[0];
  p.state = 'active';
  p.frozenType = null;
  app.lookOtherFloor();
  app.view.updateCamera(app.match, 0.5, 'normal');
});
await wait(400);
const otherFloor = await page.evaluate(() => {
  const f = window.iceWolf.view.focusPoint(window.iceWolf.match);
  const p = window.iceWolf.match.actors[0];
  return { focusX: Math.round(f.x), px: Math.round(p.x), floor: p.floor };
});
check('the floor button pans to the other hall', Math.abs(otherFloor.focusX - otherFloor.px) > 20, JSON.stringify(otherFloor));

console.log('\n== 10. stage lighting rules ==');
const lightRules = await page.evaluate(async () => {
  const app = window.iceWolf;
  const out = {};
  for (const id of ['classic', 'park']) {
    app.chooseStage(id);
    await new Promise((r) => setTimeout(r, 120));
    out[id] = { sun: app.view.sun.castShadow, map: app.view.renderer.shadowMap.enabled };
  }
  app.chooseStage('classic');
  return out;
});
check('classic keeps cast shadows', lightRules.classic.sun === true && lightRules.classic.map === true, JSON.stringify(lightRules.classic));
check('park turns cast shadows off', lightRules.park.sun === false && lightRules.park.map === false, JSON.stringify(lightRules.park));

console.log('\n== 11. result screen ==');
await page.evaluate(() => {
  const app = window.iceWolf;
  app.startMatch({ players: 7, wolves: 1 });
  app.phase = 'play';
  const m = app.match;
  for (const a of m.actors) if (a.role === 'human' && a.state === 'active') a.state = 'frozen';
});
await wait(1700);
check('result overlay appears when the match ends', await page.locator('#result').isVisible());
const resultText = await page.locator('#result').innerText();
check('result shows the wolf win', resultText.includes('WOLVES') || resultText.includes('人狼'), JSON.stringify(resultText).slice(0, 200));
await shot('result');
await page.click('#toMenuBtn');
await wait(600);

console.log('\n== 12. layouts: English X-Large, Hindi Large, iPhone SE ==');
for (const [lang, size, tag] of [['en', 'xlarge', 'en-xlarge'], ['hi', 'large', 'hi-large'], ['ja', 'xlarge', 'ja-xlarge']]) {
  await page.evaluate(({ l, s }) => {
    const app = window.iceWolf;
    app.changeLanguage(l);
    app.changeSettings({ textSize: s, stage: 'classic' });
    app.startMatch({});
    app.phase = 'play';
    app.ui.hideBrief();
    app.ui.showCountdown(0);
  }, { l: lang, s: size });
  await wait(700);
  const over = await overflow('.hud-card, .hud-btn, #hintBar, #actionLabel, .action:not(.big-action)');
  check(`${tag}: HUD fits without overflow`, over.length === 0, JSON.stringify(over).slice(0, 300));
  await shot(`hud-${tag}`);
  await page.evaluate(() => window.iceWolf.toMenu());
  await wait(300);
  await page.evaluate(() => window.iceWolf.ui.openSettingsSheet());
  await wait(300);
  const sheetOver = await overflow('#sheetBody .row, #sheetBody .chip, #sheetBody .hintline');
  check(`${tag}: settings sheet fits`, sheetOver.length === 0, JSON.stringify(sheetOver).slice(0, 300));
  await page.evaluate(() => window.iceWolf.ui.closeSheet());
}

await page.setViewportSize({ width: 750, height: 375 });
await page.evaluate(() => { window.iceWolf.changeLanguage('ja'); window.iceWolf.changeSettings({ textSize: 'xlarge' }); });
await wait(500);
const smallOver = await overflow('.menu-left, #startBtn');
check('iPhone SE landscape: home fits', smallOver.length === 0, JSON.stringify(smallOver).slice(0, 300));
await shot('home-iphone-se-ja-xlarge');
await page.setViewportSize({ width: 900, height: 600 });

console.log('\n== 13. no runtime errors ==');
check('no page errors or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('FAILED:');
  for (const f of failed) console.log(` - ${f.name} ${f.detail}`);
}
await browser.close();
server.close();
process.exit(failed.length ? 1 : 0);
