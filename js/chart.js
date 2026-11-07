/* The chart: one card per section, with a cell for each bar and a lyric cue line for each time the section is sung.
   Plain calculations, with no DOM, so they can be tested on their own. The chart has no defaults: a bar is empty until
   its notes (bass) or chords (guitar) are entered, and a cue line is empty until its cue is written.

   The song's chart is kept in its notes:
     notes.chart.notes  { "<bar>": "G" }           bass note for a bar, "-" for a rest bar
     notes.chart.tags   { "<bar>": ["Stab"] }      tags for a bar; Stab draws the stab colour, Slide the slide colour
     notes.chart.cues   { "verse:2": "Lyric…" }    the lyric cue for the second time the verse is sung
   Guitar bars use the song's chords (notes.chords), sounding as the editor shows them.

   A cell is { kind: 'note' | 'stab' | 'slide' | 'rest' | 'empty', text, bar }. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};

  // The name a section goes by, without its number: "Verse 2" and "Verse" are both "verse".
  const baseKey = (name) => String(name || '').replace(/\s*\d+$/, '').trim().toLowerCase();

  // The cell for one bar, from what the bar holds.
  //   info  { text, rest, tags }: the bar's note or chord text, whether it is a rest, and its tags
  function cellKind(info) {
    const tags = (info && info.tags) || [];
    if (info && info.rest) return 'rest';
    if (!info || !info.text) return 'empty';
    if (tags.includes('Stab')) return 'stab';
    if (tags.includes('Slide')) return 'slide';
    return 'note';
  }

  // The chart for the song's sections.
  //   groups   the song's sections as the cards show them: { name, key, occ: [part index] }
  //   parts    the song's parts: { start, end, occNo }
  //   cellFor  bar index -> { text, rest, tags }
  //   cueFor   cue key ("verse:2") -> the cue text, or ''
  function chartSections({ groups, parts, cellFor = () => null, cueFor = () => '' }) {
    return groups.map((g) => {
      const first = parts[g.occ[0]];
      const count = first.end - first.start + 1;
      const cells = [];
      for (let i = 0; i < count; i++) {
        const bar = first.start + i;
        const info = cellFor(bar) || {};
        cells.push({ kind: cellKind(info), text: info.text || '', bar, tags: info.tags || [] });
      }
      const key = baseKey(g.name);
      // one line per time the section is sung: "Verse 1", "Verse 2"… (or just the name when it is sung once)
      const lines = g.occ.map((pi, k) => ({
        label: g.occ.length > 1 ? `${key.replace(/^./, (c) => c.toUpperCase())} ${k + 1}` : g.name.replace(/\s*\d+$/, ''),
        cue: cueFor(`${key}:${k + 1}`) || '',
        key: `${key}:${k + 1}`,
      }));
      return { name: g.name, group: g.key, cells, lines };
    });
  }

  // The tags a chart can carry. The quick tags are offered in the editor.
  const QUICK_TAGS = ['Stab', 'Rest', 'Slide', 'Fill', 'Hit', 'Pickup'];

  SM.chart = { chartSections, cellKind, baseKey, QUICK_TAGS };
})(typeof window !== 'undefined' ? window : globalThis);
