import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
globalThis.window = undefined;
require('../../js/songlogic.js');
require('../../js/drums.js');
const { applyFeel, drumFreeBars } = globalThis.SM.drums;

const beat = (index, dur, notes, playbackStart = index * 960, dynamics = 4) => ({ index, duration: dur, notes, playbackStart, dynamics });
// one bar of eighth-note hits (a roll of four), then a rest, then one hit
function bars() {
  const roll = [0, 1, 2, 3].map((i) => beat(i, 8, [{}], i * 480, 4));
  return [{ index: 0, voices: [{ index: 0, beats: [...roll, beat(4, 4, [], 1920, 4), beat(5, 4, [{}], 2880, 4)] }] }];
}
const memory = () => ({ straight: new WeakMap(), loudness: new WeakMap() });
const TPM = 960 * 120 / 60000;   // ticks per millisecond at 120 bpm

test('straight drums keep their own timing and loudness', () => {
  const b = bars();
  const before = b[0].voices[0].beats.map((x) => [x.playbackStart, x.dynamics]);
  const m = memory();
  applyFeel(b, { ms: 0, loud: false, swell: false, ticksPerMs: TPM }, m);
  assert.deepEqual(b[0].voices[0].beats.map((x) => [x.playbackStart, x.dynamics]), before);
});

test('a timing feel moves each beat by a fixed amount, and clearing it goes back', () => {
  const b = bars();
  const original = b[0].voices[0].beats.map((x) => x.playbackStart);
  const m = memory();
  applyFeel(b, { ms: 20, loud: false, swell: false, ticksPerMs: TPM }, m);
  const moved = b[0].voices[0].beats.map((x) => x.playbackStart);
  assert.notDeepEqual(moved, original);
  moved.forEach((p, i) => assert.ok(Math.abs(p - original[i]) <= 20 * TPM + 1, `beat ${i} moved too far`));
  // the same feel applied again gives the same result
  applyFeel(b, { ms: 20, loud: false, swell: false, ticksPerMs: TPM }, m);
  assert.deepEqual(b[0].voices[0].beats.map((x) => x.playbackStart), moved);
  // clearing the feel returns the beats to their own timing
  applyFeel(b, { ms: 0, loud: false, swell: false, ticksPerMs: TPM }, m);
  assert.deepEqual(b[0].voices[0].beats.map((x) => x.playbackStart), original);
});

test('the loudness feel varies hits by at most one level and keeps them in range', () => {
  const b = bars();
  applyFeel(b, { ms: 0, loud: true, swell: false, ticksPerMs: TPM }, memory());
  const hits = b[0].voices[0].beats.filter((x) => x.notes.length);
  hits.forEach((h) => assert.ok(h.dynamics >= 3 && h.dynamics <= 5, `dynamic ${h.dynamics}`));
});

test('a swell builds a roll to its middle and back, and does not touch a short run', () => {
  const b = bars();
  applyFeel(b, { ms: 0, loud: false, swell: true, ticksPerMs: TPM }, memory());
  const roll = b[0].voices[0].beats.slice(0, 4).map((x) => x.dynamics);
  // a roll of four: the ends are not louder than the middle
  assert.ok(roll[1] >= roll[0] && roll[2] >= roll[3]);
  // the single hit at the end is a run of one, so it stays at its own level
  assert.equal(b[0].voices[0].beats[5].dynamics, 4);
});

test('a bar is drum-free when none of its notes are drum notes', () => {
  const clickNote = { click: true };
  const drumBars = [
    { voices: [{ beats: [{ notes: [{}] }] }] },
    { voices: [{ beats: [{ notes: [] }] }] },
    { voices: [{ beats: [{ notes: [clickNote] }] }] },
  ];
  const isClick = (n) => n === clickNote;
  assert.deepEqual([...drumFreeBars(3, drumBars, isClick)], [false, true, true]);
  assert.deepEqual([...drumFreeBars(2, null, isClick)], [true, true]);
});
