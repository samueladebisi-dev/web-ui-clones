// Loads every clone in a headless browser and fails if a page throws, logs a
// console error, or requests a local file that doesn't exist. It also lists
// the external hosts each page contacts, because the clones should not depend
// on (or hotlink from) other sites. External failures are reported but
// ignored, so the check also works offline.
//
//   npm test                 # all clones
//   npm test -- netflix      # selected clones
import { readdir, access, readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import { ROOT, startServer } from './serve.mjs';

// The root index.html links to every clone; it is checked like a clone.
const GALLERY = 'gallery';
const cloneDir = (clone) => (clone === GALLERY ? ROOT : join(ROOT, clone));
const clonePath = (clone) => (clone === GALLERY ? '' : `${clone}/`);

async function listClones() {
  const clones = [];
  for (const entry of await readdir(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      await access(join(ROOT, entry.name, 'index.html'));
      clones.push(entry.name);
    } catch {}
  }
  return clones.sort();
}

// Static check of every local src/href in index.html. Browsers fetch some
// resources (such as favicons) unreliably in headless mode, so a missing file
// isn't always visible as a failed request.
async function missingReferences(clone) {
  const dir = cloneDir(clone);
  const html = await readFile(join(dir, 'index.html'), 'utf8');
  const missing = [];
  for (const [, ref] of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(ref)) continue; // external, data:, javascript: or anchor
    const target = resolve(dir, ref.split(/[?#]/)[0]);
    if (!target.startsWith(dir + sep)) {
      missing.push(`reference outside the clone folder: ${ref}`);
      continue;
    }
    try {
      await access(target);
    } catch {
      missing.push(`missing file: ${ref}`);
    }
  }
  return missing;
}

// Every clone folder should be linked from the gallery, and nothing else.
async function galleryMismatches(clones) {
  const html = await readFile(join(ROOT, 'index.html'), 'utf8');
  const linked = [...html.matchAll(/href="([^"/]+)\/"/g)].map((m) => m[1]);
  return [
    ...clones.filter((c) => !linked.includes(c)).map((c) => `gallery does not link to ${c}`),
    ...linked.filter((l) => !clones.includes(l)).map((l) => `gallery links to unknown clone ${l}`),
  ];
}

async function check(browser, base, clone) {
  // A fresh context per clone, so a cached 404 can't hide a missing file later.
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = await missingReferences(clone);
  const external = [];
  const hosts = new Set();
  const isLocal = (url) => url.startsWith(base);

  page.on('pageerror', (err) => errors.push(`uncaught: ${err.message}`));
  page.on('console', (msg) => {
    // Resource failures are classified below by URL instead.
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) {
      errors.push(`console: ${msg.text()}`);
    }
  });
  page.on('request', (req) => {
    if (!isLocal(req.url()) && /^https?:/.test(req.url())) hosts.add(new URL(req.url()).host);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      (isLocal(res.url()) ? errors : external).push(`HTTP ${res.status()} ${res.url()}`);
    }
  });
  page.on('requestfailed', (req) => {
    (isLocal(req.url()) ? errors : external).push(`failed ${req.url()} (${req.failure()?.errorText})`);
  });

  await page.goto(`${base}${clonePath(clone)}`, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await context.close();
  return { errors, external, hosts: [...hosts].sort() };
}

const cloneFolders = await listClones();
const allClones = [GALLERY, ...cloneFolders];
const wanted = process.argv.slice(2);
const unknown = wanted.filter((c) => !allClones.includes(c));
if (unknown.length) {
  console.error(`Unknown clone(s): ${unknown.join(', ')}. Available: ${allClones.join(', ')}`);
  process.exit(1);
}
const clones = wanted.length ? wanted : allClones;

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

let failed = 0;
try {
  for (const clone of clones) {
    const { errors, external, hosts } = await check(browser, base, clone);
    if (clone === GALLERY) errors.push(...(await galleryMismatches(cloneFolders)));
    console.log(`${errors.length ? 'FAIL' : 'ok  '}  ${clone}`);
    for (const e of errors) console.log(`        ${e}`);
    if (hosts.length) console.log(`        external hosts: ${hosts.join(', ')}`);
    if (process.env.VERBOSE) for (const e of external) console.log(`        (external, ignored) ${e}`);
    if (errors.length) failed++;
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${clones.length - failed}/${clones.length} clones passed`);
process.exit(failed ? 1 : 0);
