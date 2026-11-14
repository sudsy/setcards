/* Drum feel and the bars the click plays in. Plain calculations on the score's bars and beats, with no DOM and no
   alphaTab, so they can be tested on their own. A bar is { index, voices: [{ index, beats: [...] }] } and a beat is
   { index, playbackStart, dynamics, duration, notes: [...] }. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};
  const DYN_MIN = 0, DYN_MAX = 7;       // ppp .. fff

  // Applies the drum feel to the bars. feel: { ms, loud, swell, ticksPerMs }. memory: { straight, loudness } are
  // WeakMaps that keep each beat's own timing and loudness, so the feel can be changed and set again later.
  // With no feel set, every beat goes back to its own timing and loudness.
  function applyFeel(bars, feel, memory) {
    const { ms, loud, swell, ticksPerMs } = feel;
    const { hashOf, hitOffset } = SM.songLogic;
    bars.forEach((bar) => bar.voices.forEach((v) => {
      // timing: every beat, straight or moved by a fixed amount
      v.beats.forEach((b) => {
        if (!memory.straight.has(b)) memory.straight.set(b, b.playbackStart);
        const key = `${bar.index}.${v.index}.${b.index}`;
        b.playbackStart = memory.straight.get(b) + (ms ? hitOffset(key, ms * ticksPerMs) : 0);
      });
      // loudness: the hits (beats with notes), each at its own level; a roll (a run of repeated hits) can swell
      const hits = v.beats.filter((b) => b.notes.length);
      hits.forEach((b) => { if (!memory.loudness.has(b)) memory.loudness.set(b, b.dynamics); });
      const runStart = new Map();
      for (let k = 0; k < hits.length; k++) {
        if (k > 0 && hits[k].duration === hits[k - 1].duration) runStart.set(hits[k], runStart.get(hits[k - 1]));
        else runStart.set(hits[k], k);
      }
      hits.forEach((b, k) => {
        const start = runStart.get(b);
        let end = k;
        while (end + 1 < hits.length && runStart.get(hits[end + 1]) === start) end++;
        const runLength = end - start + 1;
        let d = 0;
        if (loud) d += (hashOf(`${bar.index}.${v.index}.${b.index}`, 1) % 3) - 1;
        if (swell && runLength >= 4) {
          // builds to the middle of the roll and fades back: -1, 0 or +1 level
          const t = 1 - Math.abs((2 * (k - start)) / (runLength - 1) - 1);
          d += Math.round(2 * t - 1);
        }
        b.dynamics = Math.min(DYN_MAX, Math.max(DYN_MIN, memory.loudness.get(b) + d));
      });
    }));
  }

  // The bars where the click plays: the bars where the drums have no notes. notesOf(note) says whether a note counts
  // as a drum note (the click's own side sticks do not). With no drum bars given, every bar is drum-free.
  function drumFreeBars(barCount, drumBars, isClickNote) {
    const out = [];
    for (let i = 0; i < barCount; i++) {
      const bar = drumBars && drumBars[i];
      out.push(!(bar && bar.voices.some((v) => v.beats.some((b) => b.notes.some((n) => !isClickNote(n))))));
    }
    return out;
  }

  // The default kit (kits/drums-default.sf2, Sonic Implants "Stereo Drums Dry") has a sample for every drum note used
  // here, so no note is remapped. Kept as a table for a kit that lacks a note. Checked in tests/unit/drums.test.mjs.
  const DEFAULT_KIT_REMAP = {};
  const kitNote = (key) => (DEFAULT_KIT_REMAP[key] !== undefined ? DEFAULT_KIT_REMAP[key] : key);

  // The studio kit's levels against the kick, from recordings of the same bars: the snare and hi-hats sat too high.
  // A factor on each hit's velocity, for the default kit only. The kick is unchanged.
  const DEFAULT_KIT_LEVEL = { 38: 0.3, 42: 0.35, 44: 0.3, 46: 0.35 };
  const kitVelocity = (key, velocity) => {
    const f = DEFAULT_KIT_LEVEL[key];
    return f === undefined ? velocity : Math.max(1, Math.min(127, Math.round(velocity * f)));
  };

  SM.drums = { applyFeel, drumFreeBars, DYN_MIN, DYN_MAX, DEFAULT_KIT_REMAP, kitNote, DEFAULT_KIT_LEVEL, kitVelocity };
})(typeof window !== 'undefined' ? window : globalThis);
