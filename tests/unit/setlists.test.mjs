import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
globalThis.window = undefined;
require('../../js/setlists.js');
const S = globalThis.SM.setlists;

const song = (n, extra = {}) => ({ key: `drive:${n}`, title: `Song ${n}`, artist: 'Band', ...extra });

test('a new set list is empty and named', () => {
  const l = S.blank('  Friday   gig ', 5);
  assert.equal(l.name, 'Friday gig');
  assert.deepEqual(l.songs, []);
  assert.equal(l.updatedAt, 5);
  assert.equal(S.blank('').name, 'New set list');
});

test('songs are added at the end, once each', () => {
  let l = S.blank('x');
  l = S.add(l, song(1));
  l = S.add(l, song(2));
  l = S.add(l, song(1));
  assert.deepEqual(l.songs.map((s) => s.key), ['drive:1', 'drive:2']);
  assert.equal(S.has(l, 'drive:2'), true);
  assert.equal(S.add(l, null), l);
});

test('a song moves up and down, and stops at either end', () => {
  let l = S.blank('x');
  [1, 2, 3].forEach((n) => { l = S.add(l, song(n)); });
  l = S.move(l, 2, -1);
  assert.deepEqual(l.songs.map((s) => s.key), ['drive:1', 'drive:3', 'drive:2']);
  assert.equal(S.move(l, 0, -1), l);
  assert.equal(S.move(l, 2, 1), l);
  l = S.move(l, 0, 1);
  assert.deepEqual(l.songs.map((s) => s.key), ['drive:3', 'drive:1', 'drive:2']);
});

test('removing a song keeps the order of the rest', () => {
  let l = S.blank('x');
  [1, 2, 3].forEach((n) => { l = S.add(l, song(n)); });
  l = S.remove(l, 'drive:2');
  assert.deepEqual(l.songs.map((s) => s.key), ['drive:1', 'drive:3']);
  assert.equal(S.remove(l, 'drive:9').songs.length, 2);
});

test('a stored set list round-trips with its order', () => {
  let l = S.blank('Gig', 7);
  [3, 1, 2].forEach((n) => { l = S.add(l, song(n)); });
  const back = S.parse(S.serialise(l));
  assert.deepEqual(back, l);
});

test('a file that is not a set list is skipped', () => {
  assert.equal(S.parse('not json'), null);
  assert.equal(S.parse(JSON.stringify({ format: 'setcards/1', songs: [] })), null);
  assert.equal(S.parse(JSON.stringify({ format: S.FORMAT, songs: 'nope' })), null);
  assert.equal(S.parse(null), null);
});

test('a damaged entry is dropped, and a song listed twice keeps its first place', () => {
  const l = S.parse(JSON.stringify({ format: S.FORMAT, name: '', songs: [{ key: 'drive:1', title: 'A' }, null, { title: 'no key' }, { key: 'drive:1', title: 'again' }, { key: 'drive:2' }] }));
  assert.equal(l.name, 'New set list');
  assert.deepEqual(l.songs.map((s) => [s.key, s.title]), [['drive:1', 'A'], ['drive:2', '']]);
});

test('a file name is safe to save', () => {
  assert.equal(S.fileNameFor('Friday / gig: "The Anchor"?'), 'Friday  gig The Anchor.setlist.json');
  assert.equal(S.fileNameFor(''), 'Set list.setlist.json');
});

test('each song says whether it is missing or can be played', () => {
  let l = S.blank('x');
  l = S.add(l, song(1));
  l = S.add(l, song(2));
  l = S.add(l, song(3));
  const lib = new Map([['drive:1', { hasTab: true }], ['drive:2', { hasTab: false }]]);
  assert.deepEqual(S.resolve(l, lib).map((s) => [s.key, s.missing, s.playable]), [
    ['drive:1', false, true], ['drive:2', false, false], ['drive:3', true, false]
  ]);
});
