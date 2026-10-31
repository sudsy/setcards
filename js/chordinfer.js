/* Chords from the notes of a tab part, one per bar. Works on plain data (no DOM, no alphaTab), so it can be tested
   on its own. Each bar is a list of note events: { pitch: MIDI key, start: ticks from the bar's start, dur: ticks }.

   Rules, for tabs written as arpeggios and passing notes:
   - Every note counts toward the bar's chord, weighted by how long it sounds, so an arpeggio (C E G C) is the chord.
   - A note on the bar's first beat counts more than one that falls between beats.
   - A short note that moves stepwise between its neighbours is a passing or neighbour note, and counts little.
   - The lowest sounding note gives the bass. A chord whose root is the bass is preferred to one with another bass.
   - A bar keeps the chord of the bar before when that chord fits nearly as well, so a passing note cannot change it.
   - A bar with no notes gets null (its chord is not changed). A bar whose notes fit no chord well gets null too. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};

  const BEAT = 960;            // ticks per quarter note, as alphaTab counts them
  const PASSING = 0.3;         // weight of a passing or neighbour note
  const OFFBEAT = 0.8;         // weight of a note that falls between beats
  const FIRST_BEAT = 1.5;      // weight of a note on the bar's first beat
  const MIN_FIT = 0.6;         // the least share of the bar's notes a chord must explain
  const KEEP_MARGIN = 0.08;    // the previous chord is kept when it fits this close to the best one

  // quality: the notes above the root, and the suffix written after the root name
  const QUALITIES = [
    { q: '', tones: [0, 4, 7] },
    { q: 'm', tones: [0, 3, 7] },
    { q: '7', tones: [0, 4, 7, 10] },
    { q: 'm7', tones: [0, 3, 7, 10] },
    { q: 'maj7', tones: [0, 4, 7, 11] },
    { q: '6', tones: [0, 4, 7, 9] },
    { q: 'sus4', tones: [0, 5, 7] },
    { q: 'sus2', tones: [0, 2, 7] },
    { q: 'dim', tones: [0, 3, 6] },
  ];
  const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // The weight of each note in a bar, by pitch class: long notes, notes on the beat, and not passing notes.
  function barWeights(events, barLen) {
    const w = new Array(12).fill(0);
    const sorted = events.slice().sort((a, b) => a.start - b.start || a.pitch - b.pitch);
    sorted.forEach((e, i) => {
      let k = e.dur;
      if (e.start === 0) k *= FIRST_BEAT;
      else if (e.start % BEAT !== 0) k *= OFFBEAT;
      const prev = sorted[i - 1], next = sorted[i + 1];
      const short = e.dur < BEAT / 2 && e.start % BEAT !== 0;
      const stepwise = prev && next && Math.abs(e.pitch - prev.pitch) <= 2 && Math.abs(e.pitch - next.pitch) <= 2;
      if (short && stepwise) k *= PASSING;
      w[((e.pitch % 12) + 12) % 12] += k;
    });
    return w;
  }

  // How well a chord (root and its tones) fits the weights: the share it explains, less what it leaves out.
  function fitOf(w, total, root, tones, bassPc) {
    const inChord = new Set(tones.map((t) => (root + t) % 12));
    let explained = 0, extra = 0;
    for (let pc = 0; pc < 12; pc++) {
      if (inChord.has(pc)) explained += w[pc];
      else extra += w[pc];
    }
    // every tone of the chord should be there; a missing tone counts against the chord
    const missing = [...inChord].filter((pc) => w[pc] === 0).length;
    const fit = (explained - 0.7 * extra) / total - 0.1 * missing + (root === bassPc ? 0.05 : 0);
    return { fit, share: explained / total };
  }

  // The chord (root, quality) that best explains the weights.
  function bestChord(w, bassPc) {
    const total = w.reduce((a, b) => a + b, 0);
    if (total <= 0) return null;
    let best = null;
    for (let root = 0; root < 12; root++) {
      for (const { q, tones } of QUALITIES) {
        const { fit, share } = fitOf(w, total, root, tones, bassPc);
        // simpler chords win a tie: the list is in that order and only a strictly better fit replaces a chord
        if (!best || fit > best.fit + 1e-9) best = { root, q, fit, share };
      }
    }
    return best;
  }

  function lowestPc(events) {
    if (!events.length) return -1;
    const lowest = events.reduce((a, b) => (b.pitch < a.pitch ? b : a));
    return ((lowest.pitch % 12) + 12) % 12;
  }

  // One name per bar: a chord name (spelled with spell(pc)) or null where the chord is left alone.
  function inferBars(bars, opts) {
    const o = opts || {};
    const spell = o.spell || ((pc) => SHARP_NAMES[pc]);
    const barLen = o.barLen || BEAT * 4;
    const out = [];
    let prev = null;   // { root, q } of the last chord named
    bars.forEach((bar) => {
      const events = (bar && bar.events) || [];
      if (!events.length) { out.push(null); return; }
      const w = barWeights(events, barLen);
      const bass = lowestPc(events);
      const best = bestChord(w, bass);
      if (!best || best.share < MIN_FIT) { out.push(null); return; }
      let chosen = best;
      if (prev) {
        // the chord before is kept when it still fits nearly as well
        const total = w.reduce((x, y) => x + y, 0);
        const before = QUALITIES.find((x) => x.q === prev.q);
        const kept = fitOf(w, total, prev.root, before.tones, bass);
        if (kept.share >= MIN_FIT && kept.fit >= best.fit - KEEP_MARGIN) chosen = { root: prev.root, q: prev.q };
      }
      prev = { root: chosen.root, q: chosen.q };
      out.push(spell(chosen.root) + chosen.q);
    });
    return out;
  }

  SM.chordInfer = { inferBars, barWeights, bestChord, BEAT };
})(typeof window !== 'undefined' ? window : globalThis);
