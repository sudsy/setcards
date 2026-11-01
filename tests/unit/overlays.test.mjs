import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
globalThis.window = undefined;
require('../../js/overlays.js');
const { create } = globalThis.SM.overlays;

test('every layer is hidden while the work runs, and shown again after', () => {
  const o = create();
  const log = [];
  o.add({ hide: () => log.push('hide a'), show: () => log.push('show a') });
  o.add({ hide: () => log.push('hide b'), show: () => log.push('show b') });
  const result = o.without(() => { log.push('work'); return 42; });
  assert.equal(result, 42);
  // shown in the reverse order, so the layers unwind as they were laid on
  assert.deepEqual(log, ['hide a', 'hide b', 'work', 'show b', 'show a']);
});

test('the layers are shown again even when the work throws', () => {
  const o = create();
  let shown = false;
  o.add({ hide() {}, show() { shown = true; } });
  assert.throws(() => o.without(() => { throw new Error('export failed'); }), /export failed/);
  assert.equal(shown, true);
});
