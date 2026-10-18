import test from 'node:test';
import assert from 'node:assert/strict';
import { SM, scoreFromTex, partsFromMarkers, bassSong } from './helpers.mjs';

const A = SM.analysis;
const noChords = () => [];

const riffX = ['0.4.4 0.4.4 2.3.4 0.4.4', '3.4.4 3.4.4 5.3.4 3.4.4'];
const riffXFill = ['0.4.4 0.4.4 2.3.4 0.4.4', '3.4.4 3.4.4 5.3.8 5.3.8 7.3.4'];
const riffY = ['5.3.2 7.3.2', '3.3.2 5.3.2'];

test('a repeated 2-bar riff is found once and counted', () => {
  const score = bassSong([...riffX, ...riffX, ...riffX, ...riffX], { 0: 'Verse' });
  const res = A.analyse(score, 0, partsFromMarkers(score), noChords);
  assert.equal(res.parts[0].unit, 2);
  assert.equal(res.parts[0].summary, 'A ×4');
  assert.equal(res.riffs.length, 1);
});

test('a fill in the last repeat is the same riff, marked as changed', () => {
  const score = bassSong([...riffX, ...riffX, ...riffX, ...riffXFill], { 0: 'Verse' });
  const res = A.analyse(score, 0, partsFromMarkers(score), noChords);
  assert.equal(res.parts[0].summary, 'A ×4');
  const last = res.parts[0].units[3];
  assert.equal(last.variant, true);
  assert.deepEqual(last.changed, [7]);
});

test('a riff used again in a later section keeps its letter', () => {
  const score = bassSong([...riffX, ...riffX, ...riffY, ...riffY, ...riffX, ...riffX], { 0: 'Verse', 4: 'Chorus', 8: 'Verse' });
  const res = A.analyse(score, 0, partsFromMarkers(score), noChords);
  assert.deepEqual(res.parts.map((p) => p.summary), ['A ×2', 'B ×2', 'A ×2']);
});

test('a section that changes riff part way through lists both', () => {
  const score = bassSong([...riffX, ...riffX, ...riffY, ...riffY], { 0: 'Chorus' });
  const res = A.analyse(score, 0, partsFromMarkers(score), noChords);
  assert.equal(res.parts[0].summary, 'A ×2 · B ×2');
});

test('a forced repeat length overrides the automatic one', () => {
  const score = bassSong([...riffX, ...riffX], { 0: 'Verse' });
  const res = A.analyse(score, 0, partsFromMarkers(score), noChords, [4]);
  assert.equal(res.parts[0].unit, 4);
  assert.equal(res.parts[0].summary, 'A');
});

test('the demo song breaks down as expected', () => {
  const score = scoreFromTex(globalThis.DEMO_SONG.tex);
  const parts = partsFromMarkers(score);
  assert.deepEqual(parts.map((p) => p.name), ['Intro', 'Verse 1', 'Pre-chorus', 'Chorus', 'Verse 2', 'Pre-chorus', 'Chorus', 'Bridge', 'Chorus', 'Outro']);
  const res = A.analyse(score, 0, parts, noChords);
  const verse1 = res.parts[1];
  const verse2 = res.parts[4];
  assert.equal(verse1.summary, verse2.summary, 'both verses use the same riffs');
  const lastChorus = res.parts[8];
  assert.ok(lastChorus.units.some((u) => u.variant), 'the last chorus ending is marked as changed');
});

test('suggested sections give repeats of the same groove the same name', () => {
  const groove = [...riffX, ...riffX];
  const other = [...riffY, ...riffY];
  const score = bassSong([...groove, ...other, ...groove]);
  const suggested = A.suggestSections(score, 0, noChords);
  assert.deepEqual(suggested.map((s) => s.start), [0, 4, 8]);
  assert.equal(suggested[0].name, suggested[2].name);
  assert.notEqual(suggested[0].name, suggested[1].name);
});

test('identical bars compare as the same, different bars do not', () => {
  const score = bassSong([riffX[0], riffX[0], riffY[0]]);
  const t = (i) => A.barTokens(score, 0, i);
  assert.equal(A.tokenSim(t(0), t(1)), 1);
  assert.ok(A.tokenSim(t(0), t(2)) < 0.5);
  assert.equal(A.tokenSim([], []), 1);
});

test('lyric cues join syllables and skip a word carried over from before', () => {
  const tex = `\\title "Lyrics"
.
\\track "Vocals"
\\lyrics "Smooth o-pe-ra-tor Dia-mond li-ife lo-ver boy"
C4.4 C4.4 C4.4 C4.4 | C4.4 C4.4 C4.4 C4.4 | C4.4 C4.4 C4.4 C4.4 |`;
  const score = scoreFromTex(tex);
  // bar 1 starts mid-word ("ra-tor"), so its cue begins at the next whole word
  assert.equal(A.lyricCue(score, 1, 2, 3), 'Diamond life lover');
  // a word that runs past the end of the section is still finished
  assert.equal(A.lyricCue(score, 0, 0, 2), 'Smooth operator');
});

test('chords written in the file are read per bar', () => {
  const tex = `\\title "Chords"
.
\\track "Guitar"
\\chord ("Am" 0 1 2 2 0 x)
\\chord ("G" 3 0 0 0 2 3)
(0.5 1.4).2 {ch "Am"} (3.6).2 {ch "G"} | (0.5).1 {ch "Am"} |`;
  const score = scoreFromTex(tex);
  const fc = A.fileChords(score);
  assert.deepEqual(fc[0].map((c) => c.name), ['Am', 'G']);
  assert.equal(fc[0][1].pos, 0.5);
  assert.deepEqual(fc[1].map((c) => c.name), ['Am']);
});

test('song details: key from the file when set, estimated otherwise, plus tempo and length', () => {
  const minorSong = scoreFromTex(`\\title "Minor" \\tempo 90
.
\\track "Bass" \\staff {tabs} \\tuning (G2 D2 A1 E1) \\instrument 33
\\ks Dminor 0.3.4 0.3.4 3.3.4 5.3.4 | 0.2.4 3.2.4 0.3.2 |`);
  const meta = A.songMeta(minorSong);
  assert.equal(meta.key, 'Dm');
  assert.equal(meta.keyGuessed, false);
  assert.equal(meta.tempo, 90);
  assert.equal(meta.bars, 2);
  assert.equal(meta.seconds, Math.round(8 * 60 / 90));

  const demo = A.songMeta(scoreFromTex(globalThis.DEMO_SONG.tex));
  assert.equal(demo.keyGuessed, true);
  assert.ok(demo.key, 'an estimated key is given');
  assert.equal(demo.tempo, 104);
});
