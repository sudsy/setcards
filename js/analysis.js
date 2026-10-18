/* Songmap analysis: finds the repeating riffs inside sections and suggests sections for unmarked files.
   Works on alphaTab score objects and has no DOM code, so it can be tested outside the browser. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};

  const SAME = 0.999;    // identical bars
  const SIMILAR = 0.5;   // a variation of the same bar (a fill, a changed ending)
  const RIFF_MATCH = 0.7; // two units count as the same riff
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  /* ---------- per bar fingerprints ---------- */

  // Each note becomes "position:pitch", position measured as a fraction of the bar in 48ths.
  function barTokens(score, trackIndex, barIndex) {
    const track = score.tracks[trackIndex];
    const staff = track && track.staves[0];
    const bar = staff && staff.bars[barIndex];
    if (!bar || staff.isPercussion) return [];
    const total = score.masterBars[barIndex].calculateDuration() || 1;
    const out = [];
    bar.voices.forEach((v) => v.beats.forEach((b) => {
      if (b.isRest) return;
      const pos = Math.round((b.playbackStart / total) * 48);
      b.notes.forEach((n) => {
        if (n.isTieDestination) return;
        out.push(`${pos}:${n.isDead ? 'x' : n.realValue}`);
      });
    }));
    return out.sort();
  }

  function tokenSim(a, b) {
    if (!a.length && !b.length) return 1;
    if (!a.length || !b.length) return 0;
    const count = {};
    a.forEach((t) => { count[t] = (count[t] || 0) + 1; });
    let common = 0;
    b.forEach((t) => { if (count[t] > 0) { count[t]--; common++; } });
    return common / Math.max(a.length, b.length);
  }

  /* ---------- chords and lyrics from the file ---------- */

  // Chord names written anywhere in the file, per bar, with their position in the bar (0 to 1).
  function fileChords(score) {
    const out = {};
    score.tracks.forEach((track) => track.staves.forEach((staff) => {
      if (!staff.chords || !staff.chords.size) return;
      staff.bars.forEach((bar, i) => {
        const total = score.masterBars[i].calculateDuration() || 1;
        bar.voices.forEach((v) => v.beats.forEach((b) => {
          if (!b.chordId) return;
          const ch = staff.chords.get(b.chordId);
          if (!ch || !ch.name) return;
          (out[i] = out[i] || []).push({ name: ch.name.trim(), pos: b.playbackStart / total });
        }));
      });
    }));
    Object.keys(out).forEach((k) => {
      const seen = {};
      out[k] = out[k].sort((a, b) => a.pos - b.pos).filter((c) => {
        const key = c.name + '@' + c.pos.toFixed(2);
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      }).filter((c, i, arr) => i === 0 || c.name !== arr[i - 1].name);
    });
    return out;
  }

  // The first few sung words from a bar onwards, as a cue for the singer.
  // Syllables ending in "-" continue the word; a word carried over from the previous section is skipped.
  function lyricCue(score, startBar, endBar, maxWords) {
    for (const track of score.tracks) {
      const staff = track.staves[0];
      const syllables = (from, to) => {
        const out = [];
        for (let i = Math.max(0, from); i <= to && staff.bars[i]; i++) {
          staff.bars[i].voices[0].beats.forEach((b) => { if (b.lyrics && b.lyrics[0] && b.lyrics[0].trim()) out.push(b.lyrics[0].trim()); });
        }
        return out;
      };
      const own = syllables(startBar, endBar);
      if (!own.length) continue;
      const ownCount = own.length;
      own.push(...syllables(endBar + 1, endBar + 1));   // lets the last word finish in the next bar
      const before = syllables(startBar - 2, startBar - 1);
      let k = 0;
      if (before.length && before[before.length - 1].endsWith('-')) {
        while (k < own.length && own[k].endsWith('-')) k++;
        k++;
      }
      const words = [];
      let open = false;
      for (; k < own.length && (words.length < maxWords || open) && (k < ownCount || open); k++) {
        let syl = own[k];
        const cont = syl.endsWith('-');
        syl = syl.replace(/-+$/, '');
        if (open && words.length) {
          let prev = words[words.length - 1];
          // "li-" + "ife" is one sung "life": drop the repeated vowel at the join
          if (/[aeiouy]$/i.test(prev) && prev.slice(-1).toLowerCase() === syl.charAt(0).toLowerCase()) syl = syl.slice(1);
          words[words.length - 1] = prev + syl;
        } else {
          words.push(syl);
        }
        open = cont;
      }
      return words.join(' ');
    }
    return '';
  }

  /* ---------- the song model ---------- */

  // chordsFor(bar) returns the chord names for a bar; used when the track has no notes in either bar.
  function makeComparer(score, trackIndex, chordsFor) {
    const cache = {};
    const tokens = (i) => cache[i] || (cache[i] = barTokens(score, trackIndex, i));
    const chordKey = (i) => (chordsFor(i) || []).join(' ');
    return {
      barSim(a, b) {
        const ta = tokens(a);
        const tb = tokens(b);
        if (!ta.length && !tb.length) {
          const ca = chordKey(a);
          const cb = chordKey(b);
          return ca === cb ? 1 : 0;
        }
        return tokenSim(ta, tb);
      },
      unitSim(a, b, len) {
        let s = 0;
        for (let k = 0; k < len; k++) s += this.barSim(a + k, b + k);
        return s / len;
      },
      isEmpty: (i) => !tokens(i).length
    };
  }

  /**
   * Breaks every section occurrence into repeating units and labels them as riffs A, B, C…
   * parts: [{start, end}] in song order. Returns {riffs, parts:[{unit, units:[{start,len,riff,variant}], summary}]}.
   */
  function analyse(score, trackIndex, parts, chordsFor, overrides) {
    const cmp = makeComparer(score, trackIndex, chordsFor);
    const riffs = [];
    const newId = (list) => LETTERS[list.length % 26] + (list.length >= 26 ? Math.floor(list.length / 26) + 1 : '');

    // Splits a section into units of p bars, matching each unit against known riffs (adding new ones to `list`).
    function split(p, start, end, list) {
      const units = [];
      for (let s = start; s <= end; s += p) {
        const ulen = Math.min(p, end - s + 1);
        let best = null;
        let bestSim = 0;
        list.forEach((r) => {
          if (r.len !== ulen) return;
          const sim = cmp.unitSim(r.start, s, ulen);
          if (sim > bestSim) { bestSim = sim; best = r; }
        });
        let riff = best;
        if (!riff || bestSim < RIFF_MATCH) {
          riff = { id: newId(list), start: s, len: ulen, uses: 0, empty: true, isNew: true };
          for (let k = 0; k < ulen; k++) if (!cmp.isEmpty(s + k)) riff.empty = false;
          list.push(riff);
        }
        units.push({ start: s, len: ulen, riff });
      }
      return units;
    }

    // How much there is to remember: bars of new tab, plus a little for every change of riff.
    function cost(units) {
      let c = 0;
      let prev = null;
      units.forEach((u) => {
        if (u.riff.isNew && !u.riff.counted) { c += u.len; u.riff.counted = true; }
        if (u.riff !== prev) c += 0.75;
        prev = u.riff;
      });
      return c;
    }

    const result = parts.map((p, pi) => {
      const len = p.end - p.start + 1;
      const forced = overrides && overrides[pi];
      let unit = forced && forced > 0 ? Math.min(forced, len) : len;
      if (!forced) {
        let bestCost = Infinity;
        [1, 2, 4, 8, len].forEach((cand) => {
          if (cand > len || (cand !== len && cand * 2 > len)) return;
          const trial = riffs.map((r) => ({ ...r, isNew: false }));
          const c = cost(split(cand, p.start, p.end, trial)) + (cand === len ? 0.01 : 0);
          if (c < bestCost - 0.001) { bestCost = c; unit = cand; }
        });
      }
      const units = split(unit, p.start, p.end, riffs).map((u) => {
        u.riff.isNew = false;
        u.riff.uses++;
        const changed = [];
        for (let k = 0; k < u.len; k++) if (cmp.barSim(u.riff.start + k, u.start + k) < SAME) changed.push(u.start + k);
        return { start: u.start, len: u.len, riff: u.riff.id, variant: changed.length > 0, changed };
      });
      return { unit, units, summary: summarise(units) };
    });
    riffs.forEach((r) => { delete r.isNew; delete r.counted; });
    return { riffs, parts: result };
  }

  // "A ×4" or "A ×3 · B ×2", collapsing runs of the same riff.
  function runs(units) {
    const out = [];
    units.forEach((u) => {
      const last = out[out.length - 1];
      if (last && last.riff === u.riff) { last.count++; last.units.push(u); } else out.push({ riff: u.riff, count: 1, units: [u] });
    });
    return out;
  }
  function summarise(units) {
    return runs(units).map((r) => (r.count > 1 ? `${r.riff} ×${r.count}` : r.riff)).join(' · ');
  }

  /**
   * Suggests sections for a file without markers: a new section starts wherever the repeating riff changes.
   * Sections with the same riff sequence get the same name (Part A, Part B…).
   */
  function suggestSections(score, trackIndex, chordsFor) {
    const n = score.masterBars.length;
    const cmp = makeComparer(score, trackIndex, chordsFor);
    const blocks = [];
    let i = 0;
    while (i < n) {
      let best = { p: 1, reps: 1 };
      for (const p of [1, 2, 4]) {
        let reps = 1;
        while (i + (reps + 1) * p <= n && cmp.unitSim(i, i + reps * p, p) >= RIFF_MATCH) reps++;
        if (reps >= 2 && reps * p > best.reps * best.p) best = { p, reps };
      }
      const len = best.reps * best.p;
      const last = blocks[blocks.length - 1];
      if (best.reps < 2 && last && last.loose) {
        last.len += 1;   // bars that don't repeat join the previous loose block
      } else {
        blocks.push({ start: i, len: best.reps < 2 ? 1 : len, unit: best.p, loose: best.reps < 2 });
      }
      i += best.reps < 2 ? 1 : len;
    }
    // fold very short blocks into their neighbour so sections are at least 4 bars
    const merged = [];
    blocks.forEach((b) => {
      const last = merged[merged.length - 1];
      if (last && (b.len < 4 || last.len < 4) && (last.len + b.len) <= 16) { last.len += b.len; last.loose = last.loose || b.loose; } else merged.push({ ...b });
    });
    // name blocks by their first unit, so repeats of the same groove share a name
    const names = [];
    return merged.map((b) => {
      const u = Math.min(b.unit || 1, b.len);
      let idx = names.findIndex((x) => x.u === u && cmp.unitSim(x.start, b.start, u) >= RIFF_MATCH);
      if (idx < 0) { names.push({ start: b.start, u }); idx = names.length - 1; }
      return { start: b.start, name: `Part ${LETTERS[idx % 26]}` };
    });
  }

  /* ---------- key, tempo and length for the song list ---------- */

  const MAJOR_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const MINOR_NAMES = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
  const SIG_MAJOR = { '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F', 0: 'C', 1: 'G', 2: 'D', 3: 'A', 4: 'E', 5: 'B', 6: 'F#', 7: 'C#' };
  const SIG_MINOR = { '-7': 'Abm', '-6': 'Ebm', '-5': 'Bbm', '-4': 'Fm', '-3': 'Cm', '-2': 'Gm', '-1': 'Dm', 0: 'Am', 1: 'Em', 2: 'Bm', 3: 'F#m', 4: 'C#m', 5: 'G#m', 6: 'D#m', 7: 'A#m' };
  // Krumhansl-Kessler key profiles: how strongly each scale degree belongs to a major or minor key.
  const PROFILE_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const PROFILE_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

  function correlate(a, b) {
    const ma = a.reduce((x, y) => x + y, 0) / a.length;
    const mb = b.reduce((x, y) => x + y, 0) / b.length;
    let num = 0; let da = 0; let db = 0;
    for (let i = 0; i < a.length; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    return da && db ? num / Math.sqrt(da * db) : 0;
  }

  // Estimates the key from how long each pitch class sounds across all pitched tracks.
  function estimateKey(score) {
    const hist = new Array(12).fill(0);
    score.tracks.forEach((t) => t.staves.forEach((st) => {
      if (st.isPercussion) return;
      st.bars.forEach((bar) => bar.voices.forEach((v) => v.beats.forEach((b) => {
        if (b.isRest) return;
        b.notes.forEach((n) => { if (!n.isDead) hist[((n.realValue % 12) + 12) % 12] += b.playbackDuration || 1; });
      })));
    }));
    if (!hist.some((x) => x > 0)) return null;
    let best = null;
    for (let root = 0; root < 12; root++) {
      const rotated = hist.map((_, i) => hist[(i + root) % 12]);
      const maj = correlate(rotated, PROFILE_MAJOR);
      const min = correlate(rotated, PROFILE_MINOR);
      if (!best || maj > best.score) best = { score: maj, name: MAJOR_NAMES[root] };
      if (min > best.score) best = { score: min, name: MINOR_NAMES[root] };
    }
    return best.name;
  }

  // Key, tempo, bars and an approximate length (repeats and tempo changes aside).
  // The key comes from the file when it sets one; C major is Guitar Pro's default, so then it is estimated.
  function songMeta(score) {
    const mb = score.masterBars[0];
    const sig = mb ? mb.keySignature : 0;
    const minor = mb ? mb.keySignatureType === 1 : false;
    const fromFile = sig !== 0 || minor;
    const key = fromFile ? (minor ? SIG_MINOR[sig] : SIG_MAJOR[sig]) : estimateKey(score);
    const ticks = score.masterBars.reduce((sum, m) => sum + m.calculateDuration(), 0);
    const tempo = Math.round(score.tempo || 120);
    return { key: key || '', keyGuessed: !fromFile && !!key, tempo, bars: score.masterBars.length, seconds: Math.round((ticks / 960) * (60 / tempo)) };
  }

  /* ---------- transposing the tab ---------- */

  const MAX_FRET = 24;
  // Key signature (sharps positive, flats negative) moved by a number of semitones, written with 6 or fewer.
  function shiftKeySignature(sig, semis) {
    const pc = ((sig * 7) % 12 + 12) % 12;            // major key pitch class for this signature
    const next = (pc + semis + 120) % 12;
    let k = (next * 7) % 12;                          // signature of the new major key, 0..11 sharps
    if (k > 6) k -= 12;
    return k;
  }

  /**
   * Moves every pitched note in the score by `semis` semitones, in place.
   * Fretted notes keep their string when the new fret fits; otherwise they move to the string closest to the
   * original hand position. Notes that would be lower than the lowest open string move up an octave.
   * Chord names written in the file and key signatures move too. Returns how many notes changed octave.
   */
  function transposeScore(score, semis, transposeName) {
    if (!semis) return { octaveMoved: 0 };
    let octaveMoved = 0;
    score.tracks.forEach((track) => track.staves.forEach((staff) => {
      if (staff.isPercussion) return;
      const tuning = staff.tuning || [];
      const strings = tuning.length;
      const openPitch = (s) => tuning[strings - s];   // string 1 is the lowest
      staff.bars.forEach((bar) => bar.voices.forEach((v) => v.beats.forEach((b) => b.notes.forEach((n) => {
        if (n.isPercussion) return;
        if (strings && n.isStringed) {
          if (n.isDead) return;
          let target = openPitch(n.string) + n.fret + semis;
          let best = null;
          for (let tries = 0; tries < 3 && !best; tries++) {
            for (let s = 1; s <= strings; s++) {
              const f = target - openPitch(s);
              if (f < 0 || f > MAX_FRET) continue;
              const score_ = Math.abs(f - n.fret) + (s === n.string ? -0.5 : 0);
              if (!best || score_ < best.score) best = { s, f, score: score_ };
            }
            if (!best) { target += target < openPitch(1) ? 12 : -12; octaveMoved++; }
          }
          if (best) { n.string = best.s; n.fret = best.f; }
        } else if (typeof n.octave === 'number' && typeof n.tone === 'number') {
          const p = n.octave * 12 + n.tone + semis;
          n.octave = Math.floor(p / 12);
          n.tone = ((p % 12) + 12) % 12;
        }
      }))));
      if (staff.chords && transposeName) staff.chords.forEach((ch) => { ch.name = transposeName(ch.name, semis); });
    }));
    score.masterBars.forEach((mb) => { mb.keySignature = shiftKeySignature(mb.keySignature, semis); });
    return { octaveMoved };
  }

  SM.analysis = { transposeScore, shiftKeySignature, songMeta, estimateKey, barTokens, tokenSim, fileChords, lyricCue, analyse, runs, summarise, suggestSections, SIMILAR, RIFF_MATCH };
})(typeof window !== 'undefined' ? window : globalThis);
