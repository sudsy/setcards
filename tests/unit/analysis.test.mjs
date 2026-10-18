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

test('transposing the tab moves frets, keeps hand position, and moves chords and key', () => {
  const score = bassSong(['3.4.4 5.4.4 2.3.4 0.4.4']);   // G A B E on a 4-string bass
  const pitches = () => score.tracks[0].staves[0].bars[0].voices[0].beats.map((b) => b.notes[0].realValue);
  const before = pitches();

  const up = A.transposeScore(score, 2, SM.chords.transposeName);
  assert.deepEqual(pitches(), before.map((p) => p + 2));
  assert.equal(up.octaveMoved, 0);

  // two down from the original: the open E would be below the lowest string, so it moves up an octave
  const down = A.transposeScore(score, -4, SM.chords.transposeName);
  assert.deepEqual(pitches().slice(0, 3), before.slice(0, 3).map((p) => p - 2));
  assert.equal(pitches()[3], before[3] - 2 + 12);
  assert.equal(down.octaveMoved, 1);
  const frets = score.tracks[0].staves[0].bars[0].voices[0].beats.map((b) => b.notes[0].fret);
  assert.ok(frets.every((f) => f >= 0 && f <= 24));
});

test('key signatures and chord names follow the transposition', () => {
  assert.equal(A.shiftKeySignature(0, 2), 2);     // C to D: two sharps
  assert.equal(A.shiftKeySignature(0, -2), -2);   // C to Bb: two flats
  assert.equal(A.shiftKeySignature(4, 1), -1);    // E to F: one flat
  assert.equal(SM.chords.transposeText('Dm Am7 Gm7', -2), 'Cm Gm7 Fm7');
  assert.equal(SM.chords.semitonesBetween('E', 'D'), -2);
  // a major key and its relative minor count as the same key
  assert.equal(SM.chords.semitonesBetween('G', 'Em'), 0);
  assert.equal(SM.chords.semitonesBetween('Ab', 'Em'), -1);
  assert.equal(SM.chords.semitonesBetween('Em', 'C'), 5);   // C major sits with A minor: Em up to Am
  assert.equal(SM.chords.semitonesBetween('Cmaj7', 'C'), 0);
});

test('8 bar phrases are found even when the sections are written out in full', () => {
  // an intro, then A twice, then B and C, as in a jazz standard written without repeat signs
  const phrase = (string) => Array.from({ length: 8 }, (_, i) => `${i}.${string}.4 ${i}.${string}.4 ${i + 2}.${string}.4 ${i}.${string}.4`);
  const score = bassSong([...phrase(4), ...phrase(3), ...phrase(3), ...phrase(2), ...phrase(1)]);
  const suggested = A.suggestSections(score, 0, noChords);
  assert.deepEqual(suggested.map((s) => s.start), [0, 8, 16, 24, 32]);
  assert.deepEqual(suggested.map((s) => s.name), ['Intro', 'Part A', 'Part A', 'Part B', 'Part C']);
});

test('repeat signs and 1st and 2nd endings are followed in the play order', () => {
  const bar = (f) => `${f}.4.1`;
  // A |: B C |1. D :|2. E | F, with no repeat start before a later repeat of G
  const tex = `\\title "Repeats"\n.\n\\track "Bass"\n\\staff {tabs}\n\\tuning (G2 D2 A1 E1)\n` +
    `${bar(0)} | \\ro ${bar(1)} | ${bar(2)} | \\ae 1 \\rc 2 ${bar(3)} | \\ae 2 ${bar(4)} | ${bar(5)} | \\rc 2 ${bar(6)} |`;
  const score = scoreFromTex(tex);
  assert.deepEqual(A.playOrder(score), [0, 1, 2, 3, 1, 2, 4, 5, 6, 5, 6]);
  const plain = bassSong([...riffX, ...riffY]);
  assert.deepEqual(A.playOrder(plain), [0, 1, 2, 3]);
});

test('chords are read from one track so a notation copy and a tab copy are not mixed', () => {
  const tex = `\\title "Copies"\n.\n\\track "Gtr"\n\\staff {score}\n\\chord ("Am" 0 1 2 2 0 x) \\chord ("G" 3 0 0 0 2 3)\n` +
    `0.6.2 {ch "Am"} 0.6.2 {ch "G"} |\n\\track "Gtr tab"\n\\staff {tabs}\n\\chord ("Am" 0 1 2 2 0 x)\n0.6.1 {ch "Am"} |`;
  const score = scoreFromTex(tex);
  assert.deepEqual(A.fileChords(score)[0].map((c) => c.name), ['Am', 'G']);
});

test('a part that comes in late and a short bar before a section do not throw the sections out', () => {
  const phrase = (string) => Array.from({ length: 8 }, (_, i) => `${i}.${string}.4 ${i}.${string}.4 ${i + 2}.${string}.4 ${i}.${string}.4`);
  const rest = Array(8).fill('r.1');
  // guitar: intro, A, A, a one beat bar, B; the bass sits out the intro
  const gtr = [...phrase(6), ...phrase(5), ...phrase(5), '\\ts 1 4 0.6.4', '\\ts 4 4 ' + phrase(4)[0], ...phrase(4).slice(1)];
  const bass = [...rest, ...phrase(3), ...phrase(3), '\\ts 1 4 r.4', '\\ts 4 4 ' + phrase(2)[0], ...phrase(2).slice(1)];
  const score = scoreFromTex(`\\title "Late bass"\n.\n\\track "Gtr"\n${gtr.join(' | ')} |\n\\track "Bass"\n\\staff {tabs}\n\\tuning (G2 D2 A1 E1)\n${bass.join(' | ')} |`);
  const suggested = A.suggestSections(score, 1, noChords);
  assert.deepEqual(suggested.map((s) => [s.start, s.name]), [[0, 'Intro'], [8, 'Part A'], [16, 'Part A'], [24, 'Part B']]);
});
