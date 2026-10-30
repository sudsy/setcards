/* Changes to the notes of one Guitar Pro track. A change is a step that names a beat and a string, so the steps
   can be replayed on a fresh read of the file, and the result checked against the file that is saved.
   Works on alphaTab score objects and has no DOM code, so it can be tested outside the browser. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};

  // The beat as the file numbers it: bar, voice and beat. Bars and beats are not added or removed by these steps,
  // so the same beat has the same key on every read of the file.
  const beatKey = (beat) => `${beat.voice.bar.index}.${beat.voice.index}.${beat.index}`;

  function beatsOf(track) {
    const out = new Map();
    const staff = track.staves[0];
    staff.bars.forEach((bar) => bar.voices.forEach((v) => v.beats.forEach((b) => out.set(beatKey(b), b))));
    return out;
  }

  // The notes tied to this one, back to the first and on to the last. A tied note is the same sound, so it has the same fret.
  function tieChain(note) {
    let first = note;
    while (first.isTieDestination && first.tieOrigin) first = first.tieOrigin;
    const out = [];
    for (let n = first; n; n = n.tieDestination) out.push(n);
    return out;
  }
  // Takes a note out of its ties, so the notes either side of it stay as they are.
  function untie(note) {
    if (note.tieOrigin) { note.tieOrigin.tieDestination = null; note.tieOrigin = null; }
    if (note.tieDestination) { note.tieDestination.tieOrigin = null; note.tieDestination.isTieDestination = false; note.tieDestination = null; }
    note.isTieDestination = false;
  }

  // Steps: { op: 'set', beat, string, fret } puts a note on a string (adding it if needed), { op: 'delete', beat, string } takes it off.
  function applyOps(score, trackIndex, ops, makeNote) {
    const beats = beatsOf(score.tracks[trackIndex]);
    ops.forEach((o) => {
      const beat = beats.get(o.beat);
      if (!beat) throw new Error(`The beat ${o.beat} is not in the file`);
      const i = beat.notes.findIndex((n) => n.string === o.string);
      if (o.op === 'delete') {
        if (i >= 0) { untie(beat.notes[i]); beat.notes.splice(i, 1); }
        if (!beat.notes.length) beat.isEmpty = true;
        return;
      }
      let note = i >= 0 ? beat.notes[i] : null;
      if (!note) {
        note = makeNote(beat, o.string);
        beat.notes.push(note);
        beat.notes.sort((a, b) => a.string - b.string);
      }
      note.string = o.string;
      tieChain(note).forEach((n) => { n.fret = o.fret; });
      beat.isEmpty = false;
    });
    return score;
  }

  // Every note of the track as text, in order, so two reads of a file can be compared.
  function notesText(score, trackIndex) {
    const out = [];
    score.tracks[trackIndex].staves[0].bars.forEach((bar) => bar.voices.forEach((v) => v.beats.forEach((b) => {
      b.notes.forEach((n) => out.push(`${beatKey(b)}|${n.string}|${n.fret}|${!!n.isDead}`));
    })));
    return out;
  }

  SM.noteEdit = { beatKey, beatsOf, applyOps, notesText };
})(typeof window !== 'undefined' ? window : globalThis);
