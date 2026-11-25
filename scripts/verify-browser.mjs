/**
 * Real-browser verification of the built www/ — the build's acceptance test.
 *
 *   node scripts/verify-browser.mjs
 *
 * It opens the actual built game in Chromium (SwiftShader WebGL), plays each of
 * the six stages, drives the controls with real pointer events, checks the
 * twelve-language / large-text layouts for overflow, and saves representative
 * screenshots to downloads/icewolf-threejs-*.png.
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
/** An open, central metre on each stage, for a readable screenshot. */
const SPOT = {
  classic: { x: -10, z: -3 },
  aquarium: { x: -14, z: 0 },
  park: { x: -14, z: 0 },
  lodge: { x: -8, z: 0 },
  school: { x: -4, z: -2 },
  space: { x: -14, z: -2 },
};
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
const context = await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

await mkdir(OUT, { recursive: true });
const shot = async (name) => {
  const file = path.join(OUT, `icewolf-threejs-${name}.png`);
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

/**
 * Horizontal text overflow only. Vertical "below the fold" is fine inside a
 * scrollable sheet, and the action button's progress ring intentionally paints
 * outside its box, so those cases are not overflow.
 */
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

/* ------------------------------------------------------------------ */
console.log('\n== 1. launch, opening, home ==');
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
await wait(1400);
check('canvas exists', await page.locator('#scene').count() === 1);
const openingVisible = await page.locator('#opening').isVisible();
check('opening animation plays on first launch', openingVisible);
await shot('opening');
if (await page.locator('#skipOpening').isVisible()) {
  await page.click('#skipOpening', { timeout: 2000 }).catch(() => {});
}
await wait(900);
check('home screen is visible after skip', await page.locator('#menu').isVisible());
const homeText = await page.locator('#menu').innerText();
check('home shows START GAME', /START GAME|ゲームスタート/.test(homeText), homeText.slice(0, 60));
await shot('home');

/* home stays light: sample the top-left pixel of the panel */
const homeBrightness = await page.evaluate(() => {
  const el = document.querySelector('.menu-left');
  const c = getComputedStyle(el).backgroundColor;
  return c;
});
check('home panel is light (no dark background)', /rgba\(255, 255, 255|rgb\(255, 255, 255/.test(homeBrightness), homeBrightness);

console.log('\n== 2. sheets ==');
for (const [btn, name] of [['#settingsBtnMenu', 'settings'], ['#stageBtn', 'stages'], ['#howBtn', 'how'], ['#proBtn', 'pro'], ['#onlineBtn', 'online'], ['#recordBtn', 'record']]) {
  await page.click(btn);
  await wait(350);
  check(`${name} sheet opens`, await page.locator('#sheet').isVisible());
  await shot(`sheet-${name}`);
  await page.click('#sheetClose');
  await wait(150);
}

console.log('\n== 3. six stages ==');
await page.evaluate(() => { window.iceWolf.pro = true; window.iceWolf.ui.setPro(true); window.iceWolf.changeSettings({ players: 10, wolves: 2, switches: 5, correct: 3 }); });
for (const id of STAGES) {
  await page.evaluate(({ stageId, spot }) => {
    const app = window.iceWolf;
    app.chooseStage(stageId);
    app.startMatch({});
    app.phase = 'play';
    app.ui.hideBrief();
    app.ui.showCountdown(0);
    // Put the player on open ice so the shot shows the stage, not a wall.
    const p = app.match.actors[0];
    p.x = spot.x; p.z = spot.z; p.floor = 1; p.y = 0;
    app.view.cameraPos.set(spot.x, 10.4, spot.z + 11);
  }, { stageId: id, spot: SPOT[id] });
  await wait(1100);
  const info = await page.evaluate(() => {
    const app = window.iceWolf;
    const m = app.match;
    return {
      stage: m.stage.id,
      actors: m.actors.length,
      switches: m.switches.length,
      gates: m.gates.length,
      floor2: m.actors.some((a) => a.floor === 2),
      props: app.view.stageView.group.children.length,
      callbacks: app.view.renderer.info.render.calls,
      triangles: app.view.renderer.info.render.triangles,
      role: m.actors[0].role,
    };
  });
  check(`${id}: stage loaded with 10 actors`, info.actors === 10, JSON.stringify(info));
  check(`${id}: switches and 3 gates exist`, info.switches >= 3 && info.gates === 3);
  check(`${id}: scene has meshes`, info.props > 20 && info.triangles > 500, `${info.triangles} tris`);
  await shot(`stage-${id}`);
}

console.log('\n== 4. controls: stick, buttons, rescue, switch, camera ==');
/** A calm scene: player human, nobody else a wolf, so control tests are not
 *  disturbed by an AI hunt. */
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
const before = await page.evaluate(() => {
  const p = window.iceWolf.match.actors[0];
  return { x: p.x, z: p.z };
});
// Drag the fixed stick to the right for 700 ms.
const stick = await page.locator('#stick').boundingBox();
await page.mouse.move(stick.x + stick.width / 2, stick.y + stick.height / 2);
await page.mouse.down();
await page.mouse.move(stick.x + stick.width / 2 + 46, stick.y + stick.height / 2, { steps: 6 });
await wait(700);
await page.mouse.up();
await wait(200);
const after = await page.evaluate(() => {
  const p = window.iceWolf.match.actors[0];
  return { x: p.x, z: p.z };
});
check('fixed stick moves the player', Math.hypot(after.x - before.x, after.z - before.z) > 1.2, `${JSON.stringify(before)} -> ${JSON.stringify(after)}`);

// A tap on the action button must not move the player.
const posA = await page.evaluate(() => { const p = window.iceWolf.match.actors[0]; return { x: p.x, z: p.z }; });
const actionBox = await page.locator('#actionBtn').boundingBox();
await page.mouse.move(actionBox.x + actionBox.width / 2, actionBox.y + actionBox.height / 2);
await page.mouse.down();
await wait(120);
await page.mouse.up();
await wait(250);
const posB = await page.evaluate(() => { const p = window.iceWolf.match.actors[0]; return { x: p.x, z: p.z }; });
check('buttons never swallow movement', Math.hypot(posB.x - posA.x, posB.z - posA.z) < 0.6, `${JSON.stringify(posA)} -> ${JSON.stringify(posB)}`);

// Freeze a CPU beside the player, hold RESCUE 1.5 s, expect a thaw.
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
// SwiftShader renders slowly, so wait on the game clock rather than real time.
const rescueSeat = await page.evaluate(() => window.iceWolf.__rescueSeat);
await page.waitForFunction(
  (seat) => window.iceWolf.match.actors.find((a) => a.seat === seat).state === 'active',
  rescueSeat,
  { timeout: 20000 },
).catch(() => {});
const rescueState = await page.evaluate((seat) => window.iceWolf.match.actors.find((a) => a.seat === seat).state, rescueSeat);
await page.mouse.up();
check('holding RESCUE 1.5 s thaws a frozen teammate', rescueState === 'active', rescueState);

// Switch hold.
await calmScene();
await wait(200);
await page.evaluate(() => {
  const app = window.iceWolf;
  const m = app.match;
  const p = m.actors[0];
  const sw = m.switches.find((s) => s.correct && !s.active);
  p.x = sw.x; p.z = sw.z; p.floor = sw.floor; p.y = sw.floor === 2 ? 5.5 : 0;
  // Stop the CPU brains for this one check: a wandering CPU stepping on the same
  // switch used to make it flaky.
  for (const a of m.actors) if (a.seat !== 0) a.isCPU = false;
  app.__switchId = sw.id;
});
await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2);
await page.mouse.down();
const switchId = await page.evaluate(() => window.iceWolf.__switchId);
await page.waitForFunction(
  (id) => window.iceWolf.match.switches[id].active,
  switchId,
  { timeout: 20000 },
).catch(() => {});
const switchOn = await page.evaluate((id) => window.iceWolf.match.switches[id].active, switchId);
await page.mouse.up();
check('holding the action button 1.9 s turns a switch on', switchOn);
await shot('switch-held');

// Camera toggle.
await page.click('#camBtn');
await wait(600);
const camMode = await page.evaluate(() => window.iceWolf.settings.camera);
check('CAM switches to the overhead view', camMode === 'top', camMode);
await page.click('#camBtn');
await wait(300);

// Touch controls: the same movement through the full-screen layer.
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

// Wolf mode.
await calmScene();
await page.evaluate(() => {
  const app = window.iceWolf;
  const p = app.match.actors[0];
  p.role = 'firstWolf';
  p.form = 'wolf';
  p.wolfCooldown = 0;
  app.phase = 'play';
  // Slow software WebGL may not paint a frame inside the wait, so ask the HUD
  // for its state directly instead of racing the frame loop.
  app.updateHud();
});
await wait(400);
const wolfBtnInfo = await page.evaluate(() => {
  const el = document.getElementById('wolfBtn');
  const r = el.getBoundingClientRect();
  return { cls: el.className, w: r.width, h: r.height, role: window.iceWolf.match.actors[0].role };
});
check('WOLF button appears for a wolf', wolfBtnInfo.w > 0 && !wolfBtnInfo.cls.includes('hidden'), JSON.stringify(wolfBtnInfo));
await page.click('#wolfBtn');
await page.waitForFunction(() => window.iceWolf.match.actors[0].wolfTimer > 0, null, { timeout: 8000 }).catch(() => {});
const wolfTimer = await page.evaluate(() => window.iceWolf.match.actors[0].wolfTimer);
check('WOLF mode starts (5 s)', wolfTimer > 3, String(wolfTimer));
await shot('wolf-mode');

console.log('\n== 4b. frozen camera: self-centred, stick pans it ==');
await calmScene();
await wait(200);
// Freeze the player on purpose and watch where the camera actually is.
const frozenInfo = await page.evaluate(async () => {
  const app = window.iceWolf;
  const m = app.match;
  const p = m.actors[0];
  // Park the CPU on the deck and switch their brains off, so nobody runs over
  // and rescues the player mid-test (that is what a real teammate would do).
  for (const a of m.actors) {
    if (a.seat === 0) continue;
    a.role = 'human';
    a.state = 'active';
    a.isCPU = false;
    a.floor = 2;
    a.x = 21;
    a.z = -12 + a.seat * 2;
  }
  p.state = 'frozen';
  p.frozenType = 'human';
  p.frozenX = p.x;
  p.frozenZ = p.z;
  p.frozenFloor = p.floor;
  m.spectateSeat = null;
  // Let the HUD run once so its automatic spectate choice (Build 36) would show.
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
check('frozen: camera is the overhead view', frozenInfo.overhead);

// Drag the stick: the character must not move, the camera focus must.
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
  const focus = app.view.focusPoint(app.match);
  return {
    x: p.frozenX,
    z: p.frozenZ,
    pan: { ...app.view.frozenPan },
    focusX: focus.x,
    camX: app.view.camera.position.x,
  };
});
check('frozen: the stick does not move the frozen body', Math.hypot(posAfter.x - posBefore.x, posAfter.z - posBefore.z) < 0.01, `${JSON.stringify(posBefore)} -> ${JSON.stringify(posAfter)}`);
check('frozen: the stick pans the camera focus', Math.abs(posAfter.pan.x - posBefore.pan.x) > 1.5, `pan ${posBefore.pan.x} -> ${posAfter.pan.x}`);
await shot('frozen-camera-panned');

// CAM brings the focus home.
await page.click('#camBtn');
await wait(500);
const recentred = await page.evaluate(() => {
  const app = window.iceWolf;
  const p = app.match.actors[0];
  const focus = app.view.focusPoint(app.match);
  return { pan: { ...app.view.frozenPan }, dx: Math.abs(focus.x - p.frozenX), dz: Math.abs(focus.z - p.frozenZ) };
});
check('frozen: CAM returns the camera to the player', recentred.dx < 0.4 && recentred.dz < 0.4, JSON.stringify(recentred));

// The ‹ › buttons jump to a teammate.
await page.click('#specNext');
await wait(400);
const jumped = await page.evaluate(() => ({ seat: window.iceWolf.match.spectateSeat, pan: { ...window.iceWolf.view.frozenPan } }));
check('frozen: > jumps the camera to a teammate', jumped.seat !== null && (Math.abs(jumped.pan.x) + Math.abs(jumped.pan.z)) > 0.5, JSON.stringify(jumped));

// Thawed: the camera comes back on its own.
const thawed = await page.evaluate(() => {
  const app = window.iceWolf;
  const p = app.match.actors[0];
  p.state = 'active';
  p.frozenType = null;
  app.match.spectateSeat = null;
  // Two seconds of camera steps at a fixed dt: the same easing the loop runs,
  // without depending on how fast SwiftShader paints.
  for (let i = 0; i < 40; i += 1) app.view.updateCamera(app.match, 0.05, 'normal');
  return { pan: { ...app.view.frozenPan }, seat: app.match.spectateSeat };
});
check('thawed: the camera eases back to the player', Math.abs(thawed.pan.x) < 1 && Math.abs(thawed.pan.z) < 1 && thawed.seat === null, JSON.stringify(thawed));

console.log('\n== 4c. stage lighting rules ==');
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

console.log('\n== 5. result screen ==');
await page.evaluate(() => {
  const app = window.iceWolf;
  const m = app.match;
  for (const a of m.actors) if (a.role === 'human' && a.state === 'active') { a.state = 'frozen'; }
});
await wait(1700);
check('result overlay appears when the match ends', await page.locator('#result').isVisible());
const resultText = await page.locator('#result').innerText();
check('result shows the wolf win', resultText.includes('WOLVES') || resultText.includes('人狼'), JSON.stringify(resultText).slice(0, 200));
await shot('result');
await page.click('#toMenuBtn');
await wait(600);

console.log('\n== 6. layouts: English X-Large, Hindi Large, iPhone SE ==');
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
  await shot(`settings-${tag}`);
  await page.evaluate(() => window.iceWolf.ui.closeSheet());
}

// iPhone SE landscape size, Japanese, large text.
await page.setViewportSize({ width: 750, height: 375 });
await page.evaluate(() => { window.iceWolf.changeLanguage('ja'); window.iceWolf.changeSettings({ textSize: 'xlarge' }); });
await wait(500);
const smallOver = await overflow('#stopMissing, .menu-left, #startBtn');
check('iPhone SE landscape: home fits', smallOver.length === 0, JSON.stringify(smallOver).slice(0, 300));
await shot('home-iphone-se-ja-xlarge');
await page.setViewportSize({ width: 900, height: 600 });

console.log('\n== 7. no runtime errors ==');
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
