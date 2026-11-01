import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
globalThis.window = undefined;
require('../../js/songlogic.js');
require('../../js/drums.js');
require('../../js/kits.js');
require('../../js/click.js');
const { kits, click } = { kits: globalThis.SM.kits, click: globalThis.SM.click };

// a stand-in for the parts of SoundFont handling the kit loader uses
const soundfont = {
  DRUM_BANK: 128,
  asDrumKit: (bytes) => bytes,
  presetBanks: () => [],
  keysCovered: () => new Uint8Array(128),
};
const drumTrack = { name: 'Drums', playbackInfo: { primaryChannel: 9, program: 0, volume: 12 }, staves: [{ bars: [] }] };
function kitDeps(over = {}) {
  const loads = [];
  const logs = [];
  const toasts = [];
  const api = { loadSoundFont: (bytes, append) => loads.push({ bytes, append }) };
  const deps = {
    api, library: { kits: { load: async () => new Uint8Array([9, 9]) } }, soundfont,
    logSound: (t) => logs.push(t), toast: (t) => toasts.push(t),
    drumTrack: () => drumTrack, kitMeta: () => null, songKey: () => 'song', hasScore: () => true,
    fetch: async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }),
    urls: { kit: 'kit.sf2', synth: 'synth.sf2' }, oldIos: false, playback: true,
    ...over,
  };
  return { deps, loads, logs, toasts, kits: kits.create(deps) };
}

test('the default kit is loaded once, on top of the built-in sounds', async () => {
  const { kits: k, loads } = kitDeps();
  await k.applyDrumKit();
  assert.equal(loads.length, 1);
  assert.equal(loads[0].append, true);
  // the same kit again is not loaded twice
  await k.applyDrumKit();
  assert.equal(loads.length, 1);
});

test('a built-in choice after a kit reloads the built-in sounds first', async () => {
  let meta = null;
  const { kits: k, loads } = kitDeps({ kitMeta: () => meta });
  await k.applyDrumKit();
  meta = { builtin: true };
  await k.applyDrumKit();
  assert.equal(loads.length, 2);
  assert.equal(loads[1].append, false);
});

test('with playback off, no kit is loaded and the sound log says so', async () => {
  const { kits: k, loads, logs } = kitDeps({ playback: false });
  await k.applyDrumKit();
  assert.equal(loads.length, 0);
  assert.ok(logs.some((l) => /built-in drums play/.test(l)));
});

test('a kit that cannot be read leaves the built-in drums and says so', async () => {
  const { kits: k, loads, toasts } = kitDeps({ fetch: async () => ({ ok: false, status: 404 }) });
  await k.applyDrumKit();
  assert.equal(loads.length, 0);
  assert.ok(toasts.some((t) => /built-in drums play/.test(t)));
});

// a score of drum bars: each bar has one beat, and a beat can take a click note
function clickScore(barHits) {
  const bars = barHits.map((hit, i) => {
    const beat = { notes: hit ? [{ hit: true }] : [], isEmpty: !hit, V: undefined,
      addNote(n) { this.notes.push(n); } };
    return { index: i, voices: [{ index: 0, beats: [beat] }] };
  });
  const track = { name: 'Drums', isPercussion: true, percussionArticulations: [{ outputMidiNumber: 36 }], staves: [{ bars }] };
  return { masterBars: barHits.map(() => ({ calculateDuration: () => 3840 })), tracks: [track], track };
}
function clickDeps(score, notes) {
  const api = { loadMidiForScore() {}, render() {}, metronomeVolume: 0, countInVolume: 0 };
  class Note { constructor() { this.percussionArticulation = -1; } }
  return {
    api, AT: { model: { Note } }, notes: () => notes, score: () => score, prefs: () => ({ view: 'cards', clickLevel: 100, countInLevel: 100 }),
    listening: () => false, drumTrack: () => score.track,
  };
}

test('the side sticks are on the first beat of each drum-free bar, and go when the click is off', () => {
  const score = clickScore([true, false, false, true]);
  const notes = { click: { click: true, countIn: false } };
  const c = click.create(clickDeps(score, notes));
  c.computeClickBars();
  c.syncClickNotes();
  assert.equal(c.clickCount(), 2);
  notes.click.click = false;
  c.computeClickBars();
  c.syncClickNotes();
  assert.equal(c.clickCount(), 0);
  // the drum track's notes are back as they were
  assert.equal(score.track.staves[0].bars[1].voices[0].beats[0].notes.length, 0);
});
