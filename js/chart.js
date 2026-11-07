/* The chart view: one card per section, with a cell for each bar showing the bass note the bar starts on, and a line of
   lyric cues for each time the section is played. Plain calculations over the song's sections and bars, with no DOM, so
   they can be tested on their own. A cell is { kind: 'note', note } | { kind: 'rest' } | { kind: 'stab', note }.
   The chart uses the song's chart data (js/chart-data.js) when it has the section; otherwise it works the notes out from
   the lowest note of each bar in the tab. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};

  const NOTES_ON_D = ['D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C', 'C#'];   // fret 0 is D, fret 5 G, fret 3 F

  // The note a fret on the D string plays, moved by the song's transposition (semitones).
  function noteOnD(fret, transpose = 0) {
    return SM.chords.transposeName(NOTES_ON_D[((fret % 12) + 12) % 12], transpose);
  }

  // The name a section goes by, without its number: "Verse 2" and "Verse" are both "verse".
  const baseKey = (name) => String(name || '').replace(/\s*\d+$/, '').trim().toLowerCase();

  // The chart for the song's sections.
  //   groups    the song's sections as the cards show them: { name, occ: [part index], empty }
  //   parts     the song's parts: { start, end, occNo }
  //   bars      the tab's bars (each with its notes), by bar index
  //   dataFor   the song's chart data, or null
  //   transpose the song's transposition in semitones
  function chartSections({ groups, parts, bars, dataFor = null, transpose = 0 }) {
    const lowestNote = (bar) => {
      const notes = [];
      const beats = bar && bar.voices && bar.voices[0] ? bar.voices[0].beats : [];
      beats.forEach((b) => b.notes.forEach((n) => { if (!n.isTieDestination) notes.push(n.realValue); }));
      if (!notes.length) return null;
      const low = Math.min(...notes);
      return SM.chords.transposeName('C', ((low % 12) + 12) % 12);
    };
    return groups.map((g) => {
      const first = parts[g.occ[0]];
      const count = first.end - first.start + 1;
      const key = baseKey(g.name);
      const data = dataFor && dataFor.sections.find((s) => baseKey(s.name) === key && s.frets.length === count);
      const cells = [];
      for (let i = 0; i < count; i++) {
        if (data) {
          const fret = data.frets[i];
          if (fret === null || fret === undefined) cells.push({ kind: 'rest' });
          else cells.push({ kind: data.stabs && data.stabs.includes(i + 1) ? 'stab' : 'note', note: noteOnD(fret, transpose) });
        } else {
          const note = lowestNote(bars[first.start + i]);
          cells.push(note ? { kind: 'note', note } : { kind: 'rest' });
        }
      }
      // one line per time the section is played: "Verse 1", "Verse 2"… (or just the name when it is played once)
      const lines = g.occ.map((pi, k) => (g.occ.length > 1 ? `${baseKey(g.name).replace(/^./, (c) => c.toUpperCase())} ${k + 1}` : g.name.replace(/\s*\d+$/, '')));
      return { name: g.name, group: g.key, cells, lines, fromData: !!data };
    });
  }

  SM.chart = { chartSections, noteOnD, baseKey };
})(typeof window !== 'undefined' ? window : globalThis);
