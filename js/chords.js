/* Songmap chords: reads chord names and draws guitar chord diagrams as SVG.
   Shapes are common open chords, or E-shape and A-shape barre chords for everything else. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};

  const NOTES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // Quality spellings mapped to one key.
  const QUALITY = [
    [/^(maj7|M7|Δ7?|ma7)$/, 'maj7'],
    [/^(m\(?maj7\)?|mM7|m\(M7\)|mmaj7|-\(?maj7\)?)$/, 'mM7'],
    [/^(m7b5|m7\(b5\)|ø7?|-7b5)$/, 'm7b5'],
    [/^(dim7|o7)$/, 'dim7'],
    [/^(dim|o)$/, 'dim'],
    [/^(aug|\+)$/, 'aug'],
    [/^(7sus4?|7sus)$/, '7sus4'],
    [/^(sus4?|sus)$/, 'sus4'],
    [/^sus2$/, 'sus2'],
    [/^(m9|-9|min9)$/, 'm9'],
    [/^(maj9|M9)$/, 'maj9'],
    [/^(add9|add2|2)$/, 'add9'],
    [/^(m6|-6|min6)$/, 'm6'],
    [/^(m7|-7|min7|mi7)$/, 'm7'],
    [/^(m|-|min|mi)$/, 'm'],
    [/^(6)$/, '6'],
    [/^(9|7\(9\))$/, '9'],
    [/^(11|13|7.*)$/, '7'],
    [/^(5)$/, '5'],
    [/^(maj|M|)$/, '']
  ];

  // Low E to high e; -1 = not played. Open shapes are absolute frets.
  const OPEN = {
    'C': [-1, 3, 2, 0, 1, 0], 'A': [-1, 0, 2, 2, 2, 0], 'G': [3, 2, 0, 0, 0, 3], 'E': [0, 2, 2, 1, 0, 0], 'D': [-1, -1, 0, 2, 3, 2],
    'Am': [-1, 0, 2, 2, 1, 0], 'Em': [0, 2, 2, 0, 0, 0], 'Dm': [-1, -1, 0, 2, 3, 1],
    'A7': [-1, 0, 2, 0, 2, 0], 'E7': [0, 2, 0, 1, 0, 0], 'D7': [-1, -1, 0, 2, 1, 2], 'G7': [3, 2, 0, 0, 0, 1], 'C7': [-1, 3, 2, 3, 1, 0], 'B7': [-1, 2, 1, 2, 0, 2],
    'Am7': [-1, 0, 2, 0, 1, 0], 'Em7': [0, 2, 0, 0, 0, 0], 'Dm7': [-1, -1, 0, 2, 1, 1],
    'Cmaj7': [-1, 3, 2, 0, 0, 0], 'Fmaj7': [-1, -1, 3, 2, 1, 0], 'Amaj7': [-1, 0, 2, 1, 2, 0], 'Dmaj7': [-1, -1, 0, 2, 2, 2], 'Gmaj7': [3, 2, 0, 0, 0, 2], 'Emaj7': [0, 2, 1, 1, 0, 0],
    'Asus2': [-1, 0, 2, 2, 0, 0], 'Asus4': [-1, 0, 2, 2, 3, 0], 'Dsus2': [-1, -1, 0, 2, 3, 0], 'Dsus4': [-1, -1, 0, 2, 3, 3], 'Esus4': [0, 2, 2, 2, 0, 0],
    'Cadd9': [-1, 3, 2, 0, 3, 0], 'Dm6': [-1, -1, 0, 2, 0, 1], 'Am6': [-1, 0, 2, 2, 1, 2], 'E5': [0, 2, 2, -1, -1, -1], 'A5': [-1, 0, 2, 2, -1, -1]
  };
  // Movable shapes relative to the root fret.
  const E_SHAPE = {
    '': [0, 2, 2, 1, 0, 0], 'm': [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0], 'm7': [0, 2, 0, 0, 0, 0], 'maj7': [0, -1, 1, 1, 0, -1],
    'mM7': [0, 2, 1, 0, 0, 0], '6': [0, -1, 2, 1, 2, -1], 'm6': [0, -1, 2, 0, 2, -1], 'sus4': [0, 2, 2, 2, 0, 0], '7sus4': [0, 2, 0, 2, 0, 0],
    '9': [0, 2, 0, 1, 0, 2], 'm7b5': [0, -1, 0, 0, -1, -1], 'dim7': [0, -1, -1, 0, -1, 0], '5': [0, 2, 2, -1, -1, -1], 'add9': [0, 2, 4, 1, 0, 0]
  };
  const A_SHAPE = {
    '': [-1, 0, 2, 2, 2, 0], 'm': [-1, 0, 2, 2, 1, 0], '7': [-1, 0, 2, 0, 2, 0], 'm7': [-1, 0, 2, 0, 1, 0], 'maj7': [-1, 0, 2, 1, 2, 0],
    'mM7': [-1, 0, 2, 1, 1, 0], '6': [-1, 0, 2, 2, 2, 2], 'm6': [-1, 0, 2, 2, 1, 2], 'sus4': [-1, 0, 2, 2, 3, 0], 'sus2': [-1, 0, 2, 2, 0, 0],
    '7sus4': [-1, 0, 2, 0, 3, 0], 'dim': [-1, 0, 1, 2, 1, -1], 'dim7': [-1, 0, 1, 2, 1, 2], 'm7b5': [-1, 0, 1, 0, 1, -1], 'aug': [-1, 0, 3, 2, 2, 1],
    'add9': [-1, 0, 2, 4, 2, 0], 'm9': [-1, 0, -1, 0, 0, 2], 'maj9': [-1, 0, -1, 1, 0, -1], '5': [-1, 0, 2, 2, -1, -1]
  };

  function parse(name) {
    const m = /^\s*([A-Ga-g])([#♯b♭]?)([^/\s]*)(?:\/([A-Ga-g][#♯b♭]?))?\s*$/.exec(name || '');
    if (!m) return null;
    let root = NOTES[m[1].toUpperCase()];
    if (m[2] === '#' || m[2] === '♯') root++;
    if (m[2] === 'b' || m[2] === '♭') root--;
    root = (root + 12) % 12;
    const raw = m[3].replace(/[()]/g, (c) => c); // keep as typed for display
    let quality = null;
    for (const [re, q] of QUALITY) {
      if (re.test(raw)) { quality = q; break; }
    }
    if (quality === null) quality = /^m/.test(raw) ? 'm' : '';
    const letter = m[1].toUpperCase() + (m[2] ? (m[2] === '♯' ? '#' : m[2] === '♭' ? 'b' : m[2]) : '');
    return { root, letter, quality, raw, bass: m[4] || null };
  }

  // A playable shape for the chord, or null if the name can't be read.
  function shape(name) {
    const c = parse(name);
    if (!c) return null;
    const openKey = c.letter + c.quality;
    if (OPEN[openKey]) return { frets: OPEN[openKey].slice(), name };
    const options = [];
    const eRoot = (c.root - 4 + 12) % 12;
    const aRoot = (c.root - 9 + 12) % 12;
    if (E_SHAPE[c.quality]) options.push({ base: eRoot, rel: E_SHAPE[c.quality] });
    if (A_SHAPE[c.quality]) options.push({ base: aRoot, rel: A_SHAPE[c.quality] });
    if (!options.length) options.push({ base: eRoot, rel: E_SHAPE[c.quality.startsWith('m') ? 'm' : ''] });
    options.sort((a, b) => a.base - b.base);
    const o = options[0];
    return { frets: o.rel.map((f) => (f < 0 ? -1 : f + o.base)), name, barre: o.base || null };
  }

  // Inline SVG diagram, coloured with currentColor so it follows the theme.
  function diagram(name, opts) {
    const sh = shape(name);
    const w = (opts && opts.width) || 74;
    const h = Math.round(w * 1.35);
    const esc = String(name).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
    if (!sh) {
      return `<svg class="chord-svg" viewBox="0 0 74 100" width="${w}" height="${h}" style="width:${w}px;height:${h}px" role="img" aria-label="${esc}"><text x="37" y="11" text-anchor="middle" class="cd-name">${esc}</text><text x="37" y="55" text-anchor="middle" class="cd-note">no shape</text></svg>`;
    }
    const played = sh.frets.filter((f) => f > 0);
    const maxF = played.length ? Math.max(...played) : 0;
    const minF = played.length ? Math.min(...played) : 0;
    const start = maxF <= 4 ? 1 : minF;
    const x0 = 12; const y0 = 31; const sx = 10; const sy = 13; const frets = 5;
    let s = `<svg class="chord-svg" viewBox="0 0 74 100" width="${w}" height="${h}" style="width:${w}px;height:${h}px" role="img" aria-label="${esc} chord">`;
    s += `<text x="37" y="11" text-anchor="middle" class="cd-name">${esc}</text>`;
    if (start === 1) s += `<rect x="${x0}" y="${y0 - 2}" width="${sx * 5}" height="3" fill="currentColor"/>`;
    else s += `<text x="${x0 - 3}" y="${y0 + sy * 0.7}" text-anchor="end" class="cd-fret">${start}</text>`;
    for (let i = 0; i <= frets; i++) s += `<line x1="${x0}" x2="${x0 + sx * 5}" y1="${y0 + i * sy}" y2="${y0 + i * sy}" stroke="currentColor" stroke-opacity=".45" stroke-width="1"/>`;
    for (let i = 0; i < 6; i++) s += `<line x1="${x0 + i * sx}" x2="${x0 + i * sx}" y1="${y0}" y2="${y0 + frets * sy}" stroke="currentColor" stroke-opacity=".7" stroke-width="1"/>`;
    // a barre across all strings at the lowest fret, when the shape is a barre chord
    if (sh.barre && sh.frets.filter((f) => f === sh.barre).length >= 2) {
      const strs = sh.frets.map((f, i) => (f === sh.barre ? i : -1)).filter((i) => i >= 0);
      const first = Math.min(...strs); const last = sh.frets.length - 1;
      const y = y0 + (sh.barre - start + 0.5) * sy;
      s += `<rect x="${x0 + first * sx - 3.5}" y="${y - 3.5}" width="${(last - first) * sx + 7}" height="7" rx="3.5" fill="currentColor"/>`;
    }
    sh.frets.forEach((f, i) => {
      const x = x0 + i * sx;
      if (f < 0) s += `<text x="${x}" y="${y0 - 6}" text-anchor="middle" class="cd-mark">×</text>`;
      else if (f === 0) s += `<circle cx="${x}" cy="${y0 - 9}" r="2.8" fill="none" stroke="currentColor" stroke-width="1.2"/>`;
      else s += `<circle cx="${x}" cy="${y0 + (f - start + 0.5) * sy}" r="4" fill="currentColor"/>`;
    });
    s += '</svg>';
    return s;
  }

  // "Dm Am7 Gm7" → ['Dm','Am7','Gm7']; "-" or "N.C." means no chord.
  function split(text) {
    return String(text || '').split(/[\s|,]+/).map((t) => t.trim()).filter((t) => t && t !== '|');
  }

  /* ---------- transposing ---------- */
  const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  // Spells a pitch class the way it is usually written: flats for Db Eb Ab Bb, F# rather than Gb.
  const COMMON = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  function noteName(pc, like) {
    if (like && /b/.test(like.slice(1, 2))) return FLAT_NAMES[pc];
    if (like && /#/.test(like.slice(1, 2))) return SHARP_NAMES[pc];
    return COMMON[pc];
  }
  const pcOf = (letter) => {
    const m = /^([A-Ga-g])([#♯b♭]?)/.exec(letter || '');
    if (!m) return null;
    let v = NOTES[m[1].toUpperCase()];
    if (m[2] === '#' || m[2] === '♯') v++;
    if (m[2] === 'b' || m[2] === '♭') v--;
    return (v + 12) % 12;
  };

  // "Dm7/A" up 2 → "Em7/B". Works for key names too ("F#m" → "G#m"). Unreadable names are left alone.
  function transposeName(name, semis) {
    if (!semis || !name) return name;
    const m = /^\s*([A-Ga-g][#♯b♭]?)([^/\s]*)(?:\/([A-Ga-g][#♯b♭]?))?\s*$/.exec(name);
    if (!m) return name;
    const shift = (n) => noteName((pcOf(n) + semis + 120) % 12);
    return shift(m[1]) + m[2] + (m[3] ? '/' + shift(m[3]) : '');
  }
  const transposeText = (text, semis) => split(text).map((c) => transposeName(c, semis)).join(' ');

  // The smallest move from one key to another, in semitones (-5 to +6); null if either can't be read.
  // A major key and its relative minor share their notes (G and Em), so when one key is major and the other
  // minor, the major one is compared as its relative minor.
  const isMinor = (key) => /^[A-Ga-g][#♯b♭]?m(?!aj)/.test((key || '').trim());
  function semitonesBetween(fromKey, toKey) {
    let a = pcOf(fromKey);
    let b = pcOf(toKey);
    if (a === null || b === null) return null;
    if (isMinor(fromKey) !== isMinor(toKey)) {
      if (!isMinor(fromKey)) a = (a + 9) % 12; else b = (b + 9) % 12;
    }
    let d = (b - a + 12) % 12;
    if (d > 6) d -= 12;
    return d;
  }

  SM.chords = { parse, shape, diagram, split, transposeName, transposeText, semitonesBetween };
})(typeof window !== 'undefined' ? window : globalThis);
