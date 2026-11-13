/* A song's notes: what the band adds on top of the Guitar Pro file (sections, chords, status, keys and so on). The notes
   are plain JSON kept in the band folder next to the song. This module is the one place that knows the format: the app
   and the notes tool (scripts/notes-tool.mjs) both use it, so an edit made by an agent is checked the same way.
   It works on plain objects with no DOM and no network. The format is written up in NOTES-FORMAT.md. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};

  const FORMAT = 'setcards/1';
  const STATUSES = ['proposed', 'learning', 'ready'];
  const KEYS_OF_NOTES = ['format', 'title', 'artist', 'sections', 'chords', 'youtubeUrl', 'status', 'capo', 'transpose', 'tempo',
    'key', 'bandKey', 'originalKey', 'tabKey', 'tabFile', 'drumKit', 'drumFeel', 'click', 'simile', 'roleNotes', 'audio', 'meta', 'updatedAt', 'chart', 'edits'];

  const isInt = (n, min, max) => Number.isInteger(n) && n >= min && (max === undefined || n <= max);
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  // The problems with a notes object, as messages. An empty list means the notes are valid.
  function validate(notes) {
    const errors = [];
    if (!isObj(notes)) return ['The notes must be an object'];
    if (notes.format !== FORMAT) errors.push(`format must be "${FORMAT}"`);
    if (notes.title !== undefined && typeof notes.title !== 'string') errors.push('title must be text');
    if (notes.artist !== undefined && typeof notes.artist !== 'string') errors.push('artist must be text');
    if (notes.status !== undefined && !STATUSES.includes(notes.status)) errors.push(`status must be one of ${STATUSES.join(', ')}`);
    if (notes.capo !== undefined && !isInt(notes.capo, 0, 11)) errors.push('capo must be a whole number from 0 to 11');
    if (notes.transpose !== undefined && !isInt(notes.transpose, -11, 11)) errors.push('transpose must be a whole number from -11 to 11');
    if (notes.tempo !== undefined && !(Number.isFinite(notes.tempo) && notes.tempo > 0)) errors.push('tempo must be a positive number');
    if (notes.youtubeUrl !== undefined && typeof notes.youtubeUrl !== 'string') errors.push('youtubeUrl must be text');
    if (notes.sections !== undefined && notes.sections !== null) {
      if (!Array.isArray(notes.sections)) errors.push('sections must be a list');
      else {
        const starts = new Set();
        notes.sections.forEach((s, i) => {
          if (!isObj(s)) { errors.push(`section ${i + 1} must be an object`); return; }
          if (typeof s.id !== 'string' || !s.id) errors.push(`section ${i + 1} needs an id`);
          if (!isInt(s.start, 0)) errors.push(`section ${i + 1} needs a start bar (a whole number, counting from 0)`);
          else if (starts.has(s.start)) errors.push(`two sections start at bar ${s.start + 1}`);
          else starts.add(s.start);
          if (typeof s.name !== 'string' || !s.name.trim()) errors.push(`section ${i + 1} needs a name`);
        });
      }
    }
    if (notes.chords !== undefined) {
      if (!isObj(notes.chords)) errors.push('chords must be an object of bar number to chord names');
      else for (const [bar, text] of Object.entries(notes.chords)) {
        if (!/^\d+$/.test(bar)) errors.push(`chord bar "${bar}" must be a bar number`);
        if (typeof text !== 'string') errors.push(`chords for bar ${Number(bar) + 1} must be text`);
      }
    }
    if (notes.simile !== undefined && !(Array.isArray(notes.simile) && notes.simile.every((n) => isInt(n, 0)))) errors.push('simile must be a list of section start bars');
    if (notes.drumFeel !== undefined && !(isObj(notes.drumFeel) && (notes.drumFeel.ms === undefined || Number.isFinite(notes.drumFeel.ms)))) errors.push('drumFeel must be an object with a number ms');
    if (notes.click !== undefined && !isObj(notes.click)) errors.push('click must be an object');
    Object.keys(notes).forEach((k) => { if (!KEYS_OF_NOTES.includes(k)) errors.push(`unknown field "${k}"`); });
    return errors;
  }

  // Returns a copy of the notes with a chord set on a bar (bars count from 0 here; the tool counts from 1).
  // Empty text removes the chords. A dash means the bar has no chord, the same as the app.
  function setChord(notes, bar, text) {
    if (!isInt(bar, 0)) throw new Error('bar must be a bar number from 0');
    const next = JSON.parse(JSON.stringify(notes));
    next.chords = next.chords || {};
    const value = String(text || '').trim();
    if (value) next.chords[bar] = value;
    else delete next.chords[bar];
    return next;
  }

  // Returns a copy with a section starting at bar (0-based), named name. An existing section at that bar is renamed.
  // id is kept for an existing section, and made from the caller's id for a new one.
  function setSection(notes, bar, name, id) {
    if (!isInt(bar, 0)) throw new Error('bar must be a bar number from 0');
    const clean = String(name || '').trim();
    if (!clean) throw new Error('a section needs a name');
    const next = JSON.parse(JSON.stringify(notes));
    next.sections = next.sections || [];
    const found = next.sections.find((s) => s.start === bar);
    if (found) found.name = clean;
    else {
      if (!id) throw new Error('a new section needs an id');
      next.sections.push({ id, start: bar, name: clean });
    }
    next.sections.sort((a, b) => a.start - b.start);
    return next;
  }

  // Returns a copy with the section starting at bar removed. Its chords are kept, as the app does.
  function removeSection(notes, bar) {
    const next = JSON.parse(JSON.stringify(notes));
    next.sections = (next.sections || []).filter((s) => s.start !== bar);
    return next;
  }

  // A short summary of the notes for a person or an agent to read.
  function describe(notes) {
    const lines = [];
    lines.push(`${notes.title || '(no title)'}${notes.artist ? ` · ${notes.artist}` : ''}`);
    if (notes.status) lines.push(`status: ${notes.status}`);
    if (notes.capo) lines.push(`capo: ${notes.capo}`);
    const sections = notes.sections || [];
    lines.push(`sections: ${sections.length}`);
    sections.forEach((s) => lines.push(`  bar ${s.start + 1}: ${s.name}`));
    lines.push(`bars with chords: ${Object.keys(notes.chords || {}).length}`);
    return lines.join('\n');
  }

  SM.notes = { FORMAT, STATUSES, validate, setChord, setSection, removeSection, describe };
})(typeof window !== 'undefined' ? window : globalThis);
