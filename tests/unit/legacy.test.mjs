// The Safari 12 build: its stylesheet must avoid newer CSS, and its page must load the polyfills.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = mkdtempSync(join(tmpdir(), 'setcards-legacy-'));
execFileSync('node', [join(root, 'scripts/build-legacy.mjs'), out], { stdio: 'pipe' });
const read = (f) => readFileSync(join(out, f), 'utf8');

test('the legacy stylesheet has no colour-mix, inset, dynamic viewport or aspect-ratio', () => {
  const css = read('styles.css');
  assert.doesNotMatch(css, /color-mix\(/);
  assert.doesNotMatch(css, /\binset:/);
  assert.doesNotMatch(css, /dvh/);
  assert.doesNotMatch(css, /aspect-ratio/);
});

test('flexbox gaps become margins, and every colour companion used is defined', () => {
  const css = read('styles.css');
  assert.match(css, /> \* \+ \*/);
  const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+-rgb)\)/g)].map((m) => m[1]));
  const defined = new Set([...css.matchAll(/(--[a-z0-9-]+-rgb):/g)].map((m) => m[1]));
  const missing = [...used].filter((u) => !defined.has(u) && u !== '--seg-rgb');   // --seg-rgb is set by the polyfill
  assert.deepEqual(missing, []);
});

test('the legacy page loads the polyfills before the app, and the service worker has its own cache', () => {
  const html = read('index.html');
  const polyfill = html.indexOf('legacy-polyfills.js');
  const app = html.indexOf('src="app.js"');
  assert.ok(polyfill > 0 && polyfill < html.indexOf('src="lib/alphaTab.min.js"'));
  assert.ok(html.indexOf('dialog-polyfill.js') < app);
  assert.match(read('sw.js'), /setcards-legacy-/);
  for (const f of ['dialog-polyfill.js', 'dialog-polyfill.css', 'legacy-polyfills.js', 'lib/alphaTab.min.js']) assert.ok(existsSync(join(out, f)), f);
});
