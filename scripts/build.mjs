#!/usr/bin/env node
/**
 * Build the web layer: index.html + styles.css + src/ + vendor/ + assets/ -> www/
 *
 * The game is plain ES modules (no bundler), so "build" is: copy, check every
 * module parses, and write build-info.json. `npx cap sync ios` then copies
 * www/ into ios/App/App/public/ for the Capacitor shell.
 */
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const WWW = path.join(ROOT, 'www');

async function listFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(full)));
    else out.push(full);
  }
  return out;
}

function check(file) {
  const res = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (res.status !== 0) {
    console.error(res.stderr || res.stdout);
    throw new Error(`syntax error: ${path.relative(ROOT, file)}`);
  }
}

const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));

await rm(WWW, { recursive: true, force: true });
await mkdir(WWW, { recursive: true });

for (const name of ['index.html', 'styles.css', 'PRIVACY.md']) {
  const from = path.join(ROOT, name);
  try {
    await stat(from);
    await cp(from, path.join(WWW, name));
  } catch {
    /* optional */
  }
}
for (const dir of ['src', 'vendor', 'assets']) {
  await cp(path.join(ROOT, dir), path.join(WWW, dir), { recursive: true });
}

// Every module must parse before it ships.
const modules = (await listFiles(path.join(ROOT, 'src'))).filter((f) => f.endsWith('.js') || f.endsWith('.mjs'));
for (const file of modules) check(file);

const version = {
  name: pkg.name,
  version: pkg.version,
  // Read APP.build from the one place that owns it, so a bump never drifts.
  build: Number((await readFile(path.join(ROOT, 'src/config.js'), 'utf8')).match(/build:\s*(\d+)/)?.[1] || 0),
  productId: 'jp.signlink.IceWolf.pro',
  builtAt: new Date().toISOString(),
  modules: modules.length,
};
await writeFile(path.join(WWW, 'build-info.json'), `${JSON.stringify(version, null, 2)}\n`);

const total = (await listFiles(WWW)).length;
console.log(`built www/ — ${total} files, ${modules.length} modules, v${pkg.version} (Build ${version.build})`);
