// The v1.1.0 branch must be additive: the Pro foundation on top of the 1.0.0
// build, with the game itself untouched (1.0.0 is in App Store review).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { repoRoot, readGame, sceneOf, PRO_GROUP, I18N_GROUP } from './helpers.mjs';

const MENU_GROUP = 'v0.6.5 Production Round Start + Main Menu';
const BASE_REFS = ['origin/main', 'main'];

const git = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const baseGame = () => {
  for (const ref of BASE_REFS) {
    try {
      return JSON.parse(git(['show', `${ref}:game.json`]));
    } catch (_) { /* try the next ref */ }
  }
  return null;
};

const base = baseGame();

test('the Pro work sits on top of main and adds no gameplay change', { skip: base ? false : 'no main ref to compare with' }, () => {
  const now = readGame();
  const before = sceneOf(base).events;
  const after = sceneOf(now).events;

  assert.equal(after.length, before.length + 1, 'exactly one event group is added');
  assert.equal(after[after.length - 1].name, PRO_GROUP, 'the Pro group is the last group on the sheet');

  const markerOnly = (value) => JSON.stringify(value).replaceAll('ICE WOLF v1.1.0', 'ICE WOLF v1.0.0');
  const allowed = new Set([I18N_GROUP, MENU_GROUP]);
  for (const [index, group] of before.entries()) {
    const mine = after[index];
    assert.equal(mine.name, group.name, `group ${index} keeps its position and name`);
    if (allowed.has(group.name)) continue;
    assert.equal(markerOnly(mine).replaceAll('"version": "1.1.0"', '"version": "1.0.0"'), JSON.stringify(group),
      `group "${group.name}" is untouched apart from the release marker`);
  }

  const baseObjects = sceneOf(base).objects.map((object) => object.name);
  const newObjects = sceneOf(now).objects.map((object) => object.name);
  assert.deepEqual(newObjects, baseObjects, 'no game object was added, removed or renamed');

  const baseVars = new Set(sceneOf(base).variables.map((variable) => variable.name));
  const added = sceneOf(now).variables.map((variable) => variable.name).filter((name) => !baseVars.has(name));
  assert.ok(added.length > 0, 'the Pro state lives in scene variables');
  for (const name of added) assert.match(name, /^Pro/, `${name} is a Pro variable`);
  for (const variable of sceneOf(now).variables) {
    if (!baseVars.has(variable.name)) continue;
    const original = sceneOf(base).variables.find((item) => item.name === variable.name);
    assert.deepEqual(variable, original, `scene variable ${variable.name} keeps its value`);
  }
});

test('the branch only touches the files the Pro work owns', { skip: base ? false : 'no main ref to compare with' }, () => {
  const diff = git(['diff', '--name-only', 'origin/main...HEAD']).trim().split('\n').filter(Boolean);
  const forbidden = diff.filter((file) => file.startsWith('.github/workflows/'));
  assert.deepEqual(forbidden, [], 'the CI workflow is not modified (no permission to change it)');
  const allowedPrefixes = ['game.json', 'ios/App/App/StoreKitPlugin.swift', 'ios/App/App/SceneDelegate.swift',
    'ios/App/App.xcodeproj/project.pbxproj', 'scripts/ios/verify-ios-project.py', 'package.json',
    'package-lock.json', 'tests/pro/', 'docs/v110-pro-iap.md', 'README.md'];
  for (const file of diff) {
    assert.ok(allowedPrefixes.some((prefix) => file === prefix || file.startsWith(prefix)), `${file} is part of the v1.1.0 Pro work`);
  }
});

test('the version is 1.1.0 in one place on every side', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '1.1.0', 'package.json');
  assert.ok(pkg.scripts?.test?.includes('node --test'), 'npm test runs the test suite');

  const pbx = fs.readFileSync(path.join(repoRoot, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  const marketing = [...pbx.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((match) => match[1]);
  assert.deepEqual(marketing, ['1.1.0', '1.1.0'], 'MARKETING_VERSION in both configurations');
  const builds = [...pbx.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((match) => match[1]);
  assert.equal(new Set(builds).size, 1, 'the build number is the same in both configurations');
  assert.ok(Number(builds[0]) > 12, `the build number goes past the 1.0.0 builds: ${builds[0]}`);

  const verify = fs.readFileSync(path.join(repoRoot, 'scripts/ios/verify-ios-project.py'), 'utf8');
  assert.ok(verify.includes('DEFAULT_MARKETING_VERSION = "1.1.0"'), 'the verifier defaults to 1.1.0');
  assert.ok(verify.includes(`DEFAULT_BUILD_NUMBER = "${builds[0]}"`), 'the verifier defaults to the same build number');

  assert.equal(readGame().properties.version, '1.1.0', 'the GDevelop project version');
});

test('the Pro product id is the same in the game and in the native plugin', () => {
  const game = readGame();
  const code = sceneOf(game).events.find((group) => group.name === PRO_GROUP).events[0].inlineCode.join('\n');
  assert.ok(code.includes("'jp.signlink.IceWolf.pro'"), 'the JS asks for jp.signlink.IceWolf.pro');
  const swift = fs.readFileSync(path.join(repoRoot, 'ios/App/App/StoreKitPlugin.swift'), 'utf8');
  assert.ok(swift.includes('jp.signlink.IceWolf.pro'), 'the native plugin sells jp.signlink.IceWolf.pro');
  assert.ok(swift.includes('jsName = "IceWolfStoreKit"'), 'the plugin name matches the bridge');
  for (const method of ['proStatus', 'purchase', 'restore']) {
    assert.ok(code.includes(`.${method}(`), `the bridge calls ${method}`);
    assert.ok(swift.includes(`name: "${method}"`), `the plugin declares ${method}`);
  }
  const scene = fs.readFileSync(path.join(repoRoot, 'ios/App/App/SceneDelegate.swift'), 'utf8');
  assert.ok(scene.includes('IceWolfBridgeViewController()'), 'the app starts on the bridge controller that registers the plugin');
  assert.ok(swift.includes('registerPluginInstance(IceWolfStoreKitPlugin())'), 'the plugin is registered with the Capacitor bridge');
  const pbx = fs.readFileSync(path.join(repoRoot, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  assert.ok(pbx.includes('StoreKitPlugin.swift in Sources'), 'the plugin is compiled into the App target');
});
