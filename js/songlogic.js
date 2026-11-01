/* Plain calculations about a song's sections, riffs and drum feel. They work on plain data (the parts and section
   starts the app already has), with no DOM and no alphaTab, so they can be tested on their own.
   A part is { start, end, units: [{ riff, start, len }] }. Section starts are the bars where sections begin, in order. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};

  // The bars [from, to] of the written section that holds bar: from its start to the next section's start.
  // With no sections, the whole song (bars 0 to n - 1).
  function sectionRange(starts, bar, n) {
    let from = 0, to = n - 1;
    for (const s of starts) { if (s <= bar) from = s; else { to = s - 1; break; } }
    return [from, to];
  }

  // Every bar where the bar at offset within a riff is played, in the song, once each.
  function barsOfRiff(parts, riffId, offset) {
    const out = [];
    parts.forEach((p) => p.units.forEach((u) => { if (u.riff === riffId && offset < u.len) out.push(u.start + offset); }));
    return [...new Set(out)];
  }

  // The same, but only within the section of bar.
  function barsOfRiffInSection(parts, starts, n, riffId, offset, bar) {
    const [a, b] = sectionRange(starts, bar, n);
    return barsOfRiff(parts, riffId, offset).filter((x) => x >= a && x <= b);
  }

  // A number for a key that is the same every time: the same hit always gets the same feel (FNV-1a).
  function hashOf(key, seed) {
    let h = 2166136261 ^ seed;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  // A fixed offset, between minus and plus maxTicks, for a hit: the same hit is always moved the same amount.
  function hitOffset(key, maxTicks) {
    return Math.round((((hashOf(key, 0) % 2001) / 1000) - 1) * maxTicks);
  }

  SM.songLogic = { sectionRange, barsOfRiff, barsOfRiffInSection, hashOf, hitOffset };
})(typeof window !== 'undefined' ? window : globalThis);
