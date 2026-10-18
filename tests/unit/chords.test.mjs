import test from 'node:test';
import assert from 'node:assert/strict';
import { SM } from './helpers.mjs';

const C = SM.chords;
const frets = (name) => C.shape(name).frets.join(' ');

test('common open chords use their open shapes', () => {
  assert.equal(frets('C'), '-1 3 2 0 1 0');
  assert.equal(frets('Am7'), '-1 0 2 0 1 0');
  assert.equal(frets('Dm'), '-1 -1 0 2 3 1');
  assert.equal(frets('E9'), '0 2 0 1 0 2');
});

test('other chords become barre shapes at the right fret', () => {
  assert.equal(frets('F'), '1 3 3 2 1 1');
  assert.equal(frets('Bm'), '-1 2 4 4 3 2');
  assert.equal(frets('Gm7'), '3 5 3 3 3 3');
  assert.equal(frets('F#m7'), '2 4 2 2 2 2');
});

test('chord names are read with sharps, flats, qualities and bass notes', () => {
  assert.deepEqual(C.parse('Bbmaj7'), { root: 10, letter: 'Bb', quality: 'maj7', raw: 'maj7', bass: null });
  assert.equal(C.parse('Dm/C').bass, 'C');
  assert.equal(C.parse('C#m7b5').quality, 'm7b5');
  assert.equal(C.parse('N.C.'), null);
  assert.equal(C.shape('Dm/A').frets.join(' '), frets('Dm'), 'slash chords use the main chord shape');
});

test('chord text is split on spaces, commas and bar lines', () => {
  assert.deepEqual(C.split('Dm  Am7, Gm7 | C'), ['Dm', 'Am7', 'Gm7', 'C']);
  assert.deepEqual(C.split(''), []);
});

test('diagrams are SVG named after the chord, and unknown names say so', () => {
  const svg = C.diagram('Am');
  assert.match(svg, /^<svg class="chord-svg"/);
  assert.match(svg, />Am</);
  assert.match(C.diagram('Xyz'), /no shape/);
});
