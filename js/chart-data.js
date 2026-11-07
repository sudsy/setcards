/* Bass chart data, by song (keyed by the song's title, as the app shows it).

   Each section lists the bass riff bar by bar, as the starting fret on the D string: 5 is G, 3 is F, and null is a
   whole-bar rest. `stabs` are the bars of the section played as stabs (numbered from 1 within the section).
   A section's frets must have one entry per bar of the section in the song; otherwise the chart works the notes out
   from the tab instead.

   Bars to confirm against the recording (song bar numbers, counting from 1): 27, 40, 42, 45, 46 and 61. The data is
   as the band gave it; these bars are not yet checked. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};

  SM.chartData = {
    'Baby I Love You': {
      sections: [
        { name: 'Intro', frets: [5, 5] },
        { name: 'Verse', frets: [5, 5, 3, 3, 5, 5, 5, 5] },
        { name: 'Pre-chorus', frets: [5, 5, 3, 3, 5, 5] },
        { name: 'Chorus', frets: [5, 3, 3, 5, 5, 5, 5], stabs: [4, 5] },
        // bar 9 is a rest
        { name: 'Outro', frets: [5, 5, 5, 5, 5, 5, 5, 5, null] },
      ],
      // bars to confirm (song bar numbers): 27, 40, 42, 45, 46, 61 (see the note at the top of this file)
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
