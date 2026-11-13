import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
globalThis.window = undefined;
require('../../js/edits.js');
const E = globalThis.SM.edits;

const base = () => E.create({ title: 'Song', chords: { 1: 'G' }, chart: { cues: {} } });

test('a field is set and the change is recorded with its time and device', () => {
  const d = E.setField(base(), ['chords', '2'], 'Am', { at: 10, device: 'desk' });
  assert.equal(d.notes.chords[2], 'Am');
  assert.equal(d.notes.chords[1], 'G');
  assert.deepEqual(d.stamps['chords\u00012'], { path: ['chords', '2'], at: 10, device: 'desk' });
  assert.equal(d.undo.length, 1);
});

test('setting a field to the value it already has changes nothing', () => {
  const d = base();
  assert.equal(E.setField(d, ['chords', '1'], 'G'), d);
});

test('the original notes are never changed in place', () => {
  const d = base();
  E.setField(d, ['chords', '2'], 'Am');
  assert.equal(d.notes.chords[2], undefined);
});

test('undo puts back the value before the change, and redo puts the change back', () => {
  let d = E.setField(base(), ['title'], 'New', { at: 1 });
  d = E.undo(d, { at: 2 });
  assert.equal(d.notes.title, 'Song');
  assert.equal(d.redo.length, 1);
  d = E.redo(d, { at: 3 });
  assert.equal(d.notes.title, 'New');
  assert.equal(d.redo.length, 0);
});

test('a new change after an undo clears the redo steps', () => {
  let d = E.setField(base(), ['title'], 'A');
  d = E.undo(d);
  d = E.setField(d, ['title'], 'B');
  assert.equal(d.redo.length, 0);
});

test('undo of a field that did not exist removes it again', () => {
  let d = E.setField(base(), ['chords', '9'], 'D');
  d = E.undo(d);
  assert.equal('9' in d.notes.chords, false);
});

test('undo and redo on an empty history do nothing', () => {
  const d = base();
  assert.equal(E.undo(d), d);
  assert.equal(E.redo(d), d);
});

test('the undo history keeps only the most recent changes', () => {
  let d = base();
  for (let i = 0; i < E.UNDO_LIMIT + 25; i++) d = E.setField(d, ['chords', '5'], `C${i}`, { at: i });
  assert.equal(d.undo.length, E.UNDO_LIMIT);
  // undoing all the kept steps goes back to the first kept value, not to the start of the song
  for (let i = 0; i < E.UNDO_LIMIT; i++) d = E.undo(d);
  assert.equal(d.notes.chords[5], 'C24');
});

test('the undo history is also kept under a size limit', () => {
  let d = base();
  const big = 'x'.repeat(20000);
  for (let i = 0; i < 20; i++) d = E.setField(d, ['chart', 'cues', `k${i}`], big + i, { at: i });
  assert.ok(JSON.stringify(d.undo).length <= E.UNDO_BYTES + big.length * 2);
  assert.ok(d.undo.length < 20);
  assert.ok(d.undo.length >= 1);
});

test('a file keeps the notes and the edit history, and reads back the same', () => {
  let d = E.setField(base(), ['chords', '3'], 'F', { at: 5, device: 'phone' });
  const file = JSON.parse(JSON.stringify(E.toFile(d)));
  assert.equal(file.chords[3], 'F');
  assert.ok(file.edits);
  const back = E.fromFile(file);
  assert.deepEqual(back.notes, d.notes);
  assert.deepEqual(back.stamps, d.stamps);
  assert.deepEqual(back.undo, d.undo);
});

test('a file from before the history existed still opens', () => {
  const d = E.fromFile({ title: 'Old', chords: {} });
  assert.equal(d.notes.title, 'Old');
  assert.deepEqual(d.undo, []);
  assert.deepEqual(d.stamps, {});
});

test('merging takes each field from the copy that changed it last', () => {
  const common = E.setField(base(), ['title'], 'T1', { at: 1, device: 'a' });
  const phone = E.setField(common, ['chords', '2'], 'Bm', { at: 5, device: 'phone' });
  const desk = E.setField(common, ['title'], 'T2', { at: 6, device: 'desk' });
  const m = E.merge(phone, desk, common);
  assert.equal(m.notes.title, 'T2');
  assert.equal(m.notes.chords[2], 'Bm');
  assert.deepEqual(m.overwritten, []);
});

test('merging a copy with nothing new keeps the local copy', () => {
  const d = E.setField(base(), ['title'], 'Mine', { at: 9 });
  const m = E.merge(d, base(), base());
  assert.equal(m.notes.title, 'Mine');
});

test('a field changed on only one copy is not reported as overwritten', () => {
  const common = base();
  const a = E.setField(common, ['title'], 'Only here', { at: 3 });
  const m = E.merge(a, common, common);
  assert.equal(m.notes.title, 'Only here');
  assert.deepEqual(m.overwritten, []);
});

test('a field changed on both copies is reported, and the later change wins', () => {
  const common = base();
  const a = E.setField(common, ['title'], 'Phone title', { at: 5, device: 'phone' });
  const b = E.setField(common, ['title'], 'Desk title', { at: 7, device: 'desk' });
  const m = E.merge(a, b, common);
  assert.equal(m.notes.title, 'Desk title');
  assert.deepEqual(m.overwritten, [['title']]);
  const m2 = E.merge(b, a, common);
  assert.equal(m2.notes.title, 'Desk title');
  assert.deepEqual(m2.overwritten, [['title']]);
});

test('a field removed on the other copy is removed when it is the later change', () => {
  const common = E.setField(base(), ['chords', '4'], 'E', { at: 1 });
  const removed = E.setField(common, ['chords', '4'], undefined, { at: 8, device: 'desk' });
  const m = E.merge(common, removed, common);
  assert.equal('4' in m.notes.chords, false);
});

test('diff finds the fields that differ, down to the key inside an object', () => {
  assert.deepEqual(E.diff({ a: 1, c: { x: 1, y: 2 } }, { a: 2, c: { x: 1, y: 3 }, d: 4 }), [['a'], ['c', 'y'], ['d']]);
  assert.deepEqual(E.diff({ s: [1, 2] }, { s: [1, 2] }), []);
  assert.deepEqual(E.diff({ s: [1, 2] }, { s: [1, 3] }), [['s']]);
});

test('stamping marks only the fields that differ from the base, with the time and device', () => {
  const base = { notes: { title: 'T', chords: { 1: 'G' } }, stamps: {} };
  const next = { notes: { title: 'T2', chords: { 1: 'G' } }, stamps: {} };
  const s = E.stampChanges(base, next, { at: 9, device: 'phone' });
  assert.deepEqual(Object.keys(s.stamps), ['title']);
  assert.deepEqual(s.stamps.title, { path: ['title'], at: 9, device: 'phone' });
});

test('a field edited and then put back to the base value is not stamped as changed', () => {
  const base = { notes: { title: 'T' }, stamps: {} };
  const s = E.stampChanges(base, { notes: { title: 'T' }, stamps: {} }, { at: 9 });
  assert.deepEqual(s.stamps, {});
});

test('the bookkeeping is not content', () => {
  assert.deepEqual(E.content({ title: 'T', updatedAt: 5, edits: { stamps: {} } }), { title: 'T' });
});

test('two fields changed on two copies merge into one copy with both changes', () => {
  const base = { notes: { title: 'T', artist: 'A' }, stamps: {} };
  const phone = E.stampChanges(base, { notes: { title: 'Phone T', artist: 'A' }, stamps: {} }, { at: 5, device: 'phone' });
  const band = E.stampChanges(base, { notes: { title: 'T', artist: 'Band A' }, stamps: {} }, { at: 6, device: 'band' });
  const m = E.merge(phone, band, base);
  assert.equal(m.notes.title, 'Phone T');
  assert.equal(m.notes.artist, 'Band A');
  assert.deepEqual(m.overwritten, []);
});

test('a step records what changed, with the value before and after each field', () => {
  const st = E.step({ title: 'A', chords: { 1: 'G' } }, { title: 'B', chords: { 1: 'G', 2: 'Am' } }, 7);
  assert.equal(st.at, 7);
  assert.equal(st.changes.length, 2);
  assert.deepEqual(st.changes[0].path, ['title']);
  assert.deepEqual(st.changes[1].path, ['chords', '2']);
  assert.equal(E.step({ title: 'A' }, { title: 'A' }), null);
});

test('undoing and redoing a step put the values back and forth, including a field that did not exist', () => {
  const before = { title: 'A' };
  const after = { title: 'B', chords: { 2: 'Am' } };
  const st = E.step(before, after);
  const back = E.applyStep(after, st, 'undo');
  assert.deepEqual(back, { title: 'A' });
  assert.deepEqual(E.applyStep(back, st, 'redo'), after);
});

test('a step survives being saved to a file', () => {
  const st = E.step({ title: 'A' }, { title: 'B', chords: { 2: 'Am' } });
  const back = JSON.parse(JSON.stringify(st));
  assert.deepEqual(E.applyStep({ title: 'B', chords: { 2: 'Am' } }, back, 'undo'), { title: 'A' });
});
