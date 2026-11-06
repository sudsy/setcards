import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
globalThis.window = undefined;
require('../../js/notes.js');
const N = globalThis.SM.notes;
const base = () => ({ format: 'setcards/1', title: 'Low Road', artist: 'The Demos', sections: null, chords: {}, youtubeUrl: '', updatedAt: 0 });
const TOOL = new URL('../../scripts/notes-tool.mjs', import.meta.url).pathname;

test('a new song is valid, and bad fields are reported', () => {
  assert.deepEqual(N.validate(base()), []);
  const bad = N.validate({ ...base(), format: 'other', status: 'maybe', capo: 15, chords: { x: 'Am' }, mystery: 1 });
  assert.ok(bad.some((e) => /format/.test(e)));
  assert.ok(bad.some((e) => /status/.test(e)));
  assert.ok(bad.some((e) => /capo/.test(e)));
  assert.ok(bad.some((e) => /chord bar "x"/.test(e)));
  assert.ok(bad.some((e) => /unknown field "mystery"/.test(e)));
});

test('sections need a unique start, a name and an id', () => {
  const n = { ...base(), sections: [{ id: 'a', start: 0, name: 'Intro' }, { id: 'b', start: 0, name: 'Verse' }, { id: 'c', start: 4, name: '' }] };
  const errors = N.validate(n);
  assert.ok(errors.some((e) => /two sections start at bar 1/.test(e)));
  assert.ok(errors.some((e) => /section 3 needs a name/.test(e)));
});

test('a chord is set, replaced and cleared without changing the notes it was given', () => {
  const n = base();
  const a = N.setChord(n, 3, 'Dm7 G7');
  assert.equal(a.chords[3], 'Dm7 G7');
  assert.equal(n.chords[3], undefined);
  assert.equal(N.setChord(a, 3, '').chords[3], undefined);
  assert.equal(N.setChord(a, 3, '-').chords[3], '-');
});

test('a section is added, renamed and removed, and the list stays in order', () => {
  let n = N.setSection(base(), 8, 'Chorus', 's1');
  n = N.setSection(n, 0, 'Intro', 's2');
  assert.deepEqual(n.sections.map((s) => s.name), ['Intro', 'Chorus']);
  n = N.setSection(n, 8, 'Big Chorus');
  assert.equal(n.sections[1].name, 'Big Chorus');
  assert.equal(n.sections[1].id, 's1');
  n = N.removeSection(n, 0);
  assert.deepEqual(n.sections.map((s) => s.start), [8]);
  assert.deepEqual(N.validate(n), []);
});

test('the tool writes a valid change and refuses an invalid one', () => {
  const dir = mkdtempSync(join(tmpdir(), 'notes-'));
  const f = join(dir, 'low-road.setcards.json');
  execFileSync(process.execPath, [TOOL, 'new', f, 'Low Road', 'The Demos']);
  execFileSync(process.execPath, [TOOL, 'chord', f, '1', 'Dm7']);
  execFileSync(process.execPath, [TOOL, 'section', f, '1', 'Intro']);
  const saved = JSON.parse(readFileSync(f, 'utf8'));
  assert.equal(saved.chords[0], 'Dm7');
  assert.equal(saved.sections[0].name, 'Intro');
  const bad = spawnSync(process.execPath, [TOOL, 'chord', f, '0', 'Dm7']);
  assert.equal(bad.status, 1, 'bar 0 is not a bar number');
  const rejected = spawnSync(process.execPath, [TOOL, 'validate', f]);
  assert.equal(rejected.status, 0);
  writeFileSync(f, JSON.stringify({ ...saved, capo: 99 }));
  assert.equal(spawnSync(process.execPath, [TOOL, 'validate', f]).status, 2);
});
