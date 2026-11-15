/* Drum feel and the bars the click plays in. Plain calculations on the score's bars and beats, with no DOM and no
   alphaTab, so they can be tested on their own. A bar is { index, voices: [{ index, beats: [...] }] } and a beat is
   { index, playbackStart, dynamics, duration, notes: [...] }. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};
  const DYN_MIN = 0, DYN_MAX = 7;       // ppp .. fff

  // The drum keys that stay exactly on the beat when they land on a quarter note: the kick and the snare backbeat (and
  // the side stick). The other hits are loosened around the beat. Needs feel.keyOf(note) to give a note's drum key.
  const ANCHOR_KEYS = [35, 36, 37, 38, 40];
  const QUARTER = 960;
  const isAnchored = (b, straight, feel) => !!feel.keyOf && straight % QUARTER === 0
    && b.notes.some((n) => ANCHOR_KEYS.includes(feel.keyOf(n)));

  // The drum groups a genre's timing refers to, by drum key.
  const KEY_CLASS = { 35: 'kick', 36: 'kick', 38: 'snare', 40: 'snare', 42: 'hat', 44: 'hat', 46: 'hat' };

  // Timing by genre, from the DeMidify guide to humanizing MIDI drums (positive is late, negative is early, in ms).
  // fixed: a fixed shift for a drum group, on every hit of it. rand: a random shift of up to ms for each loosened hit,
  // for every hit or only for one drum group (only). Intensity scales the genre's shifts.
  const GENRES = {
    rock: { fixed: { kick: 4, snare: -6 } },              // snare a little ahead, kick a little behind
    funk: { rand: { ms: 6, only: 'hat' } },              // tight kick and snare, hi-hats pushed and pulled
    jazz: { rand: { ms: 12 } },                          // wider timing variation throughout
    metal: { rand: { ms: 3 } },                          // tight, with a little variation
  };
  const GENRE_NAMES = { rock: 'Rock & pop', funk: 'Funk', jazz: 'Jazz', metal: 'Metal' };

  // The genre's shift for one beat, in ticks. The fixed shifts apply on the beat as well; the random ones keep the
  // anchored hits in place, like the loosened feel.
  function genreShift(b, key, anchored, feel) {
    const g = GENRES[feel.genre];
    if (!g || !feel.keyOf) return 0;
    const groups = new Set(b.notes.map((n) => KEY_CLASS[feel.keyOf(n)]).filter(Boolean));
    let t = 0;
    if (g.fixed) Object.keys(g.fixed).forEach((c) => { if (groups.has(c)) t += g.fixed[c] * feel.ticksPerMs; });
    if (g.rand && !anchored && (!g.rand.only || groups.has(g.rand.only))) t += SM.songLogic.hitOffset(`${key}|genre`, g.rand.ms * feel.ticksPerMs);
    return Math.round(t * (feel.intensity == null ? 1 : feel.intensity));
  }

  // Applies the drum feel to the bars. feel: { ms, loud, swell, ticksPerMs, keyOf, genre, intensity } (intensity 0 to 1).
  // memory: { straight, loudness } are WeakMaps that keep each beat's own timing and loudness, so the feel can be changed
  // and set again later. With no feel set, every beat goes back to its own timing and loudness.
  function applyFeel(bars, feel, memory) {
    const { ms, loud, swell, ticksPerMs } = feel;
    const { hashOf, hitOffset } = SM.songLogic;
    bars.forEach((bar) => bar.voices.forEach((v) => {
      // timing: the loosened hits move by a fixed amount; the anchored hits (kick and backbeat on the beat) stay put;
      // a genre adds its own shifts on top
      v.beats.forEach((b) => {
        if (!memory.straight.has(b)) memory.straight.set(b, b.playbackStart);
        const straight = memory.straight.get(b);
        const key = `${bar.index}.${v.index}.${b.index}`;
        const anchored = isAnchored(b, straight, feel);
        const move = (ms && !anchored ? hitOffset(key, ms * ticksPerMs) : 0) + genreShift(b, key, anchored, feel);
        b.playbackStart = straight + move;
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

  // Level factors on each hit's velocity for the default kit (FluidR3 Standard), from a direct capture compared with Songsterr:
  // the kick was a few dB quiet, the side stick and high bongo about 7 to 10 dB loud, the low bongo about 3 dB loud.
  const DEFAULT_KIT_LEVEL = { 35: 1.3, 36: 1.3, 37: 0.5, 60: 0.4, 61: 0.7 };
  const kitVelocity = (key, velocity) => {
    const f = DEFAULT_KIT_LEVEL[key];
    return f === undefined ? velocity : Math.max(1, Math.min(127, Math.round(velocity * f)));
  };

  SM.drums = { applyFeel, drumFreeBars, DYN_MIN, DYN_MAX, DEFAULT_KIT_REMAP, kitNote, DEFAULT_KIT_LEVEL, kitVelocity, GENRES, GENRE_NAMES };
})(typeof window !== 'undefined' ? window : globalThis);
