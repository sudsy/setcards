import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
globalThis.window = undefined;
require('../../js/songlogic.js');
const { sectionRange, barsOfRiff, barsOfRiffInSection, hashOf, hitOffset } = globalThis.SM.songLogic;

// two sections: bars 0-3 (intro) and 4-9 (verse); the chorus riff is played in both
const parts = [
  { start: 0, end: 3, units: [{ riff: 'A', start: 0, len: 2 }, { riff: 'A', start: 2, len: 2 }] },
  { start: 4, end: 9, units: [{ riff: 'B', start: 4, len: 3 }, { riff: 'A', start: 7, len: 2 }, { riff: 'A', start: 9, len: 1 }] },
];

test('a section runs from its start to the next section', () => {
  assert.deepEqual(sectionRange([0, 4], 5, 10), [4, 9]);
  assert.deepEqual(sectionRange([0, 4], 3, 10), [0, 3]);
});

test('with no sections the whole song is one section', () => {
  assert.deepEqual(sectionRange([], 5, 10), [0, 9]);
});

test('a bar before the first section belongs to the whole song from 0', () => {
  assert.deepEqual(sectionRange([4], 1, 10), [0, 3]);
});

test('a riff lists each bar it is played at once, in order', () => {
  // riff A at offset 0 is played at bars 0, 2, 7 and 9
  assert.deepEqual(barsOfRiff(parts, 'A', 0), [0, 2, 7, 9]);
  // at offset 1, the bars that have a second bar of riff A
  assert.deepEqual(barsOfRiff(parts, 'A', 1), [1, 3, 8]);
});

test('a riff is only listed within its section when asked', () => {
  assert.deepEqual(barsOfRiffInSection(parts, [0, 4], 10, 'A', 0, 7), [7, 9]);
  assert.deepEqual(barsOfRiffInSection(parts, [0, 4], 10, 'A', 0, 1), [0, 2]);
});

test('a riff played once has only its own bar', () => {
  assert.deepEqual(barsOfRiff(parts, 'B', 0), [4]);
});

test('the same key always gives the same offset', () => {
  assert.equal(hashOf('3.0.1', 0), hashOf('3.0.1', 0));
  assert.notEqual(hashOf('3.0.1', 0), hashOf('3.0.2', 0));
  assert.equal(hitOffset('3.0.1', 40), hitOffset('3.0.1', 40));
});

test('an offset stays within the limit', () => {
  for (let i = 0; i < 500; i++) {
    const v = hitOffset(`bar.${i}`, 40);
    assert.ok(v >= -40 && v <= 40, `offset ${v} for key ${i}`);
  }
});
