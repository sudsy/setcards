import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
globalThis.window = undefined;
require('../../js/chart.js');
const { chartSections, cellKind, baseKey } = globalThis.SM.chart;

// a song's sections: [name, bars, times sung]; parts run on from bar 0
function song(spec) {
  const parts = []; const groups = [];
  let bar = 0;
  spec.forEach(([name, len, times]) => {
    const occ = [];
    for (let k = 0; k < times; k++) { parts.push({ start: bar, end: bar + len - 1, occNo: k + 1 }); occ.push(parts.length - 1); bar += len; }
    groups.push({ name, key: name.toLowerCase(), occ });
  });
  return { groups, parts };
}

test('a bar is empty until it has something, then a note, a stab, a slide or a rest', () => {
  assert.equal(cellKind(undefined), 'empty');
  assert.equal(cellKind({ text: '' }), 'empty');
  assert.equal(cellKind({ text: 'G' }), 'note');
  assert.equal(cellKind({ text: 'G', tags: ['Stab'] }), 'stab');
  assert.equal(cellKind({ text: 'G', tags: ['Slide'] }), 'slide');
  assert.equal(cellKind({ text: '', rest: true }), 'rest');
});

test('a chart with nothing entered is all empty bars, and empty cue lines', () => {
  const s = song([['Intro', 2, 1], ['Verse', 3, 2]]);
  const out = chartSections({ ...s });
  assert.ok(out.every((sec) => sec.cells.every((c) => c.kind === 'empty')));
  assert.deepEqual(out[1].lines.map((l) => l.cue), ['', '']);
});

test('the cells follow the bars, and the cues follow each time a section is sung', () => {
  const s = song([['Intro', 2, 1], ['Verse', 3, 2]]);
  const notes = { 0: 'G', 1: '-', 2: 'F' };
  const cues = { 'verse:1': 'Verse one words', 'verse:2': 'Verse two words' };
  const out = chartSections({ ...s, cellFor: (b) => (b === 1 ? { rest: true } : notes[b] ? { text: notes[b] } : null), cueFor: (k) => cues[k] || '' });
  assert.deepEqual(out[0].cells.map((c) => c.kind), ['note', 'rest']);
  assert.equal(out[0].cells[0].text, 'G');
  assert.deepEqual(out[0].lines.map((l) => l.label), ['Intro']);
  assert.deepEqual(out[1].cells.map((c) => c.kind), ['note', 'empty', 'empty']);
  assert.deepEqual(out[1].lines.map((l) => [l.label, l.cue]), [['Verse 1', 'Verse one words'], ['Verse 2', 'Verse two words']]);
});

test('a stab tag draws the stab, and bars take their tags from the bar', () => {
  const s = song([['Chorus', 2, 1]]);
  const out = chartSections({ ...s, cellFor: (b) => (b === 0 ? { text: 'G', tags: ['Stab'] } : { text: 'F' }) });
  assert.deepEqual(out[0].cells.map((c) => c.kind), ['stab', 'note']);
});

test('the section name without its number is the key for its cues', () => {
  assert.equal(baseKey('Verse 2'), 'verse');
  assert.equal(baseKey('Pre-chorus'), 'pre-chorus');
});
