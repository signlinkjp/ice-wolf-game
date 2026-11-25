/**
 * App-level guards: the things that must stay true for the build to be shippable.
 * These read the source and the built web layer; they catch the regressions the
 * play-test has hit before (buttons eating movement, a missing translation, a
 * CDN dependency, the wrong version).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEXTS } from '../../src/i18n.js';
import { APP, ARENA, MATCH, WOLF } from '../../src/config.js';
import { STAGES } from '../../src/data/stages.js';

const ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const read = (p) => readFile(path.join(ROOT, p), 'utf8');

async function sourceFiles(dir = 'src') {
  const out = [];
  for (const entry of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...(await sourceFiles(rel)));
    else if (entry.name.endsWith('.js')) out.push(rel);
  }
  return out;
}

test('version, bundle id and product id are the shipping ones', () => {
  assert.equal(APP.version, '1.2.0');
  assert.equal(APP.build, 35);
  assert.equal(APP.bundleId, 'jp.signlink.IceWolf');
  assert.equal(APP.productId, 'jp.signlink.IceWolf.pro');
});

test('the iOS project carries 1.2.0 / 35 and the bundle id', async () => {
  const pbx = await read('ios/App/App.xcodeproj/project.pbxproj');
  const builds = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((m) => m[1]);
  const versions = [...pbx.matchAll(/MARKETING_VERSION = ([\d.]+);/g)].map((m) => m[1]);
  assert.deepEqual(builds, ['35', '35']);
  assert.deepEqual(versions, ['1.2.0', '1.2.0']);
  assert.equal((pbx.match(/PRODUCT_BUNDLE_IDENTIFIER = jp\.signlink\.IceWolf;/g) || []).length, 2);
  const cap = await read('capacitor.config.ts');
  assert.ok(cap.includes('webDir: "www"'));
});

test('index.html carries the HUD the brief asks for and loads no CDN', async () => {
  const html = await read('index.html');
  for (const id of ['actionBtn', 'wolfBtn', 'infectBtn', 'floorBtn', 'camBtn', 'settingsBtn', 'exitBtn', 'stampBtn', 'stick', 'touchLayer']) {
    assert.ok(html.includes(`id="${id}"`), `#${id}`);
  }
  assert.ok(!/https?:\/\//.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'no external URL in index.html');
  assert.ok(html.includes('src/main.js'));
  assert.ok(!/gdevelop/i.test(html));
});

test('movement is bound to the ice, never to the buttons', async () => {
  const main = await read('src/main.js');
  // The two movement surfaces.
  assert.ok(main.includes("document.getElementById('touchLayer')"));
  assert.ok(main.includes("document.getElementById('stick')"));
  // No global pointer handler that could swallow a button press.
  assert.ok(!/window\.addEventListener\(\s*['"]pointer/.test(main));
  const css = await read('styles.css');
  assert.ok(/#hud\s*\{[^}]*pointer-events:\s*none/.test(css), 'HUD containers pass taps through');
  assert.ok(/\.hud-top-actions\s*\{[^}]*pointer-events:\s*auto/.test(css), 'HUD buttons take taps');
});

test('the light theme is the default (no dark full-screen backgrounds)', async () => {
  const css = await read('styles.css');
  assert.ok(/#menu\s*\{[^}]*rgba\(244,\s*253,\s*255/.test(css), 'home uses the ice-white veil');
  assert.ok(/\.sheet-card\s*\{[^}]*#ffffff/.test(css), 'sheets are white cards');
  assert.ok(!/background:\s*#06111f/.test(css), 'the old near-black body background is gone');
});

test('every literal t() key used by the code exists in twelve languages', async () => {
  const files = await sourceFiles();
  const keys = new Set();
  for (const file of files) {
    const src = await read(file);
    for (const m of src.matchAll(/\bt\(\s*'([^'$]+)'/g)) keys.add(m[1]);
    for (const m of src.matchAll(/set\('([a-zA-Z]+)',\s*'([a-z.]+)'\)/g)) keys.add(m[2]);
  }
  assert.ok(keys.size > 40, `found ${keys.size} keys`);
  const missing = [...keys].filter((k) => !TEXTS[k]);
  assert.deepEqual(missing, []);
});

test('the dynamic key families exist', () => {
  for (const id of ['classic', 'aquarium', 'park', 'lodge', 'school', 'space']) {
    assert.ok(TEXTS[`stage.${id}`], `stage.${id}`);
    assert.ok(TEXTS[`stage.${id}.desc`], `stage.${id}.desc`);
  }
  for (const d of MATCH.durations) assert.ok(TEXTS[`duration.${d}`], `duration.${d}`);
  for (const r of ['human', 'wolf', 'werewolf']) assert.ok(TEXTS[`role.${r}.label`], r);
});

test('the arena and rule numbers the brief fixed are still the values', () => {
  assert.equal(WOLF.maxWolves, 3);
  assert.equal(WOLF.modeSeconds, 5);
  assert.equal(WOLF.cooldownSeconds, 5);
  assert.equal(ARENA.deckY, 5.5);
  assert.equal(MATCH.maxPlayers, 10);
  assert.deepEqual(MATCH.durations, [60, 120, 180, 300]);
  assert.deepEqual(MATCH.switchCounts, [3, 5, 7, 10]);
});

test('all six stages declare both floors, doors and a gimmick where promised', () => {
  assert.equal(STAGES.length, 6);
  for (const stage of STAGES) {
    assert.ok(stage.walls.f1.length > 0, `${stage.id} 1F`);
    assert.ok(stage.walls.f2.length > 0, `${stage.id} 2F`);
    assert.equal(stage.gates.length, 3);
    assert.equal(stage.pads.length, 4);
    assert.equal(stage.stairs.length, 4);
    assert.equal(stage.warps.length, 2);
  }
  assert.equal(STAGES.find((s) => s.id === 'classic').gimmick, null);
  for (const id of ['aquarium', 'park', 'lodge', 'school', 'space']) {
    assert.ok(STAGES.find((s) => s.id === id).gimmick, id);
  }
});

test('the built web layer is complete and self-contained', async () => {
  try {
    await stat(path.join(ROOT, 'www/index.html'));
  } catch {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts/build.mjs')], { cwd: ROOT, stdio: 'ignore' });
  }
  for (const rel of ['index.html', 'styles.css', 'src/main.js', 'src/core/rules.js', 'vendor/three.module.js', 'assets/ice_freeze.png', 'assets/floor_classic.png']) {
    const s = await stat(path.join(ROOT, 'www', rel)).catch(() => null);
    assert.ok(s && s.size > 0, rel);
  }
  const main = await read('www/src/main.js');
  assert.ok(!/https?:\/\/[^'"\s]+\.(js|css)/.test(main), 'no remote script/style');
  const info = JSON.parse(await read('www/build-info.json'));
  assert.equal(info.build, 35);
});

test('the workflow the owner pastes builds Three.js, not GDevelop', async () => {
  const yml = await read('docs/ios-testflight-threejs.yml');
  assert.ok(yml.includes('npm ci'));
  assert.ok(yml.includes('npm run build'));
  assert.ok(yml.includes('npx cap sync ios'));
  assert.ok(yml.includes('xcodebuild'));
  assert.ok(yml.includes('altool --upload-app'));
  assert.ok(!yml.includes('EXPORT_HTML5_EXTERNAL'));
  assert.ok(yml.includes('jp.signlink.IceWolf'));
});
