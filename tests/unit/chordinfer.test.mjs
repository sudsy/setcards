import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// the module attaches itself to window (or globalThis); load it into a sandbox
const SM = {};
vm.runInNewContext(readFileSync(new URL('../../js/chordinfer.js', import.meta.url), 'utf8'), { window: { SM } });
const infer = (...a) => JSON.parse(JSON.stringify(SM.chordInfer.inferBars(...a)));   // plain arrays, across the VM realm
const B = 960, BAR = 3840;
// a note helper: a pitch, where it starts in the bar, and how long it sounds
const n = (pitch, start, dur) => ({ pitch, start, dur });
// the four quarter notes of a 4/4 bar
const quarters = (pitches) => pitches.map((p, i) => n(p, i * B, B));

test('a block chord gives its name', () => {
  // C major: C E G, on the first beat and held
  const bar = { events: [n(48, 0, BAR), n(52, 0, BAR), n(55, 0, BAR)] };
  assert.deepEqual(infer([bar]), ['C']);
});

test('an arpeggio spread over the bar is the same chord as the block', () => {
  // Am7 as an arpeggio: A C E G, one after another
  const bar = { events: quarters([45, 48, 52, 55]) };
  assert.deepEqual(infer([bar]), ['Am7']);
});

test('an arpeggio that repeats the root and goes back up still reads as the chord', () => {
  // D minor as eighth notes: D F A D, D F A D
  const e = (p, s) => n(p, s, B / 2);
  const bar = { events: [e(50, 0), e(53, B / 2), e(57, B), e(62, B + B / 2), e(50, 2 * B), e(53, 2 * B + B / 2), e(57, 3 * B), e(62, 3 * B + B / 2)] };
  assert.deepEqual(infer([bar]), ['Dm']);
});

test('a passing note between chord tones does not change the chord', () => {
  // C major with a short D (passing) between E and G on an off-beat
  const bar = { events: [n(48, 0, B), n(52, B, B), n(54, B + B / 2, B / 4), n(55, 2 * B, B), n(48, 3 * B, B)] };
  assert.deepEqual(infer([bar]), ['C']);
});

test('a dominant seventh needs its flat seventh', () => {
  // G B D F
  const bar = { events: quarters([55, 59, 62, 65]) };
  assert.deepEqual(infer([bar]), ['G7']);
});

test('the bass note picks between chords with the same notes', () => {
  // C E G over an A in the bass is still C here, since C E G is the chord; A alone in the bass does not change it
  const bar = { events: [n(45, 0, BAR), n(48, 0, BAR), n(52, 0, BAR), n(55, 0, BAR)] };
  assert.deepEqual(infer([bar]), ['Am7']);
});

test('a bar with no notes gives null, and leaves the chord before alone', () => {
  const bars = [{ events: [n(48, 0, BAR), n(52, 0, BAR), n(55, 0, BAR)] }, { events: [] }];
  assert.deepEqual(infer(bars), ['C', null]);
});

test('a bar whose notes fit no chord gives null', () => {
  // a cluster of semitones
  const bar = { events: [n(60, 0, B), n(61, B, B), n(62, 2 * B, B), n(63, 3 * B, B)] };
  assert.deepEqual(infer([bar]), [null]);
});

test('the chord before is kept when a passing note would change it', () => {
  // bar 1 is C; bar 2 is mostly C but has a short F# passing note that alone would read as a different chord
  const bars = [
    { events: [n(48, 0, BAR), n(52, 0, BAR), n(55, 0, BAR)] },
    { events: [n(48, 0, 3 * B), n(52, 0, 3 * B), n(55, 0, 3 * B), n(54, 3 * B, B / 4)] },
  ];
  assert.deepEqual(infer(bars), ['C', 'C']);
});

test('a run of bars names each chord in turn', () => {
  const bars = [
    { events: [n(48, 0, BAR), n(52, 0, BAR), n(55, 0, BAR)] },
    { events: [n(45, 0, BAR), n(48, 0, BAR), n(52, 0, BAR)] },
    { events: [n(43, 0, BAR), n(47, 0, BAR), n(50, 0, BAR), n(53, 0, BAR)] },
  ];
  assert.deepEqual(infer(bars), ['C', 'Am', 'G7']);
});

test('names are spelled as the caller asks', () => {
  const bar = { events: [n(50, 0, BAR), n(53, 0, BAR), n(57, 0, BAR)] };
  assert.deepEqual(infer([bar], { spell: (pc) => ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'][pc] }), ['Dm']);
  const bb = { events: [n(58, 0, BAR), n(62, 0, BAR), n(65, 0, BAR)] };
  assert.deepEqual(infer([bb], { spell: (pc) => ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'][pc] }), ['Bb']);
});
