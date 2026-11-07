import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
globalThis.window = undefined;
require('../../js/chords.js');
require('../../js/chart-data.js');
require('../../js/chart.js');
const { chartSections, noteOnD } = globalThis.SM.chart;
const DATA = globalThis.SM.chartData['Baby I Love You'];

// a song of the sections: parts with start and end bars, and groups that point at them
function song(spec) {
  const parts = []; const groups = [];
  let bar = 0;
  spec.forEach(([name, len, occurrences]) => {
    const occ = [];
    for (let k = 0; k < occurrences; k++) { parts.push({ start: bar, end: bar + len - 1, occNo: k + 1 }); occ.push(parts.length - 1); bar += len; }
    groups.push({ name, key: name.toLowerCase(), occ, empty: false });
  });
  return { groups, parts, bars: [] };
}
const EMPTY_BAR = { voices: [{ beats: [] }] };
const barWith = (pitch) => ({ voices: [{ beats: [{ notes: [{ realValue: pitch }] }] }] });

test('fret 5 on the D string is G, fret 3 is F, and a transposition moves them', () => {
  assert.equal(noteOnD(5), 'G');
  assert.equal(noteOnD(3), 'F');
  assert.equal(noteOnD(5, 2), 'A');
});

test('the Baby I Love You chart uses the band\'s data, with the stabs and the rest', () => {
  const s = song([['Intro', 2, 1], ['Verse', 8, 3], ['Pre-chorus', 6, 2], ['Chorus', 7, 2], ['Outro', 9, 1]]);
  const out = chartSections({ ...s, dataFor: DATA });
  const names = (sec) => sec.cells.map((c) => (c.kind === 'rest' ? 'rest' : c.note));
  assert.deepEqual(names(out[0]), ['G', 'G']);
  assert.deepEqual(names(out[1]), ['G', 'G', 'F', 'F', 'G', 'G', 'G', 'G']);
  assert.deepEqual(names(out[2]), ['G', 'G', 'F', 'F', 'G', 'G']);
  assert.deepEqual(names(out[3]), ['G', 'F', 'F', 'G', 'G', 'G', 'G']);
  assert.deepEqual(out[3].cells.map((c) => c.kind), ['note', 'note', 'note', 'stab', 'stab', 'note', 'note']);
  assert.equal(out[4].cells[8].kind, 'rest');
  assert.ok(out.every((sec) => sec.fromData));
});

test('one lyric line for each time a section is played', () => {
  const s = song([['Intro', 2, 1], ['Verse', 8, 3], ['Pre-chorus', 6, 2]]);
  const out = chartSections({ ...s, dataFor: DATA });
  assert.deepEqual(out[0].lines, ['Intro']);
  assert.deepEqual(out[1].lines, ['Verse 1', 'Verse 2', 'Verse 3']);
  assert.deepEqual(out[2].lines, ['Pre-chorus 1', 'Pre-chorus 2']);
});

test('without the band\'s data, each bar starts on the lowest note of the tab, and an empty bar is a rest', () => {
  const s = song([['Verse', 3, 1]]);
  // bar 1: E (low) and B; bar 2: nothing; bar 3: G
  s.bars = [{ voices: [{ beats: [{ notes: [{ realValue: 40 }, { realValue: 47 }] }] }] }, EMPTY_BAR, barWith(43)];
  const [sec] = chartSections({ ...s, dataFor: null });
  assert.equal(sec.fromData, false);
  assert.deepEqual(sec.cells.map((c) => (c.kind === 'rest' ? 'rest' : c.note)), ['E', 'rest', 'G']);
});

test('a section whose frets do not match its bars is worked out from the tab instead', () => {
  const s = song([['Verse', 3, 1]]);
  s.bars = [barWith(43), barWith(43), barWith(43)];
  const [sec] = chartSections({ ...s, dataFor: DATA });
  assert.equal(sec.fromData, false);
});
