/* Edits to a song's notes, as a pure data layer. No storage, no screen.

   A song's notes stay in one file. Every change is one field (a path such as ['chords', '12'] or ['chart', 'cues',
   'verse:2']) with the time it was made and the device that made it. The file keeps:
     notes    the notes themselves, as the rest of the app reads them
     edits    { stamps, undo }: when each field last changed (for merging copies), and the most recent undo steps
   Undo keeps the last UNDO_LIMIT changes, and drops the oldest when the history grows past UNDO_BYTES, so the file
   stays a sensible size however long the song is worked on.

   Merging two copies takes each field from whichever copy changed it last. A field changed on both copies is listed
   in `overwritten`, so the app can say so instead of losing it silently. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};
  const UNDO_LIMIT = 50;
  const UNDO_BYTES = 200000;

  const isObj = (v) => v !== null && typeof v === 'object';
  // A value as stored in the file: undefined (no value) is kept apart from any real value, since JSON drops undefined.
  const box = (v) => (v === undefined ? { none: true } : { v });
  const unbox = (b) => (b && !b.none ? b.v : undefined);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const stampKey = (path) => path.join('\u0001');

  // The value at a path, or undefined.
  function getPath(obj, path) {
    let cur = obj;
    for (const k of path) {
      if (!isObj(cur) || !(k in cur)) return undefined;
      cur = cur[k];
    }
    return cur;
  }

  // A copy of obj with the value at path set (undefined removes it). Nothing is changed in place.
  function setPath(obj, path, value) {
    if (!path.length) return value;
    const [k, ...rest] = path;
    const base = isObj(obj) ? (Array.isArray(obj) ? obj.slice() : { ...obj }) : {};
    if (rest.length) {
      base[k] = setPath(base[k], rest, value);
    } else if (value === undefined) {
      delete base[k];
    } else {
      base[k] = value;
    }
    return base;
  }

  // A new edit history with the notes it starts from.
  function create(notes) {
    return { notes: notes || {}, stamps: {}, undo: [], redo: [] };
  }

  // Drops the oldest undo steps past the count and size limits.
  function trim(undo) {
    let out = undo.length > UNDO_LIMIT ? undo.slice(undo.length - UNDO_LIMIT) : undo;
    while (out.length > 1 && JSON.stringify(out).length > UNDO_BYTES) out = out.slice(1);
    return out;
  }

  // Sets one field. Nothing happens if the value is already that. Any undone steps are lost once a new change is made.
  function setField(doc, path, value, { at = Date.now(), device = '' } = {}) {
    const before = getPath(doc.notes, path);
    if (same(before, value)) return doc;
    const notes = setPath(doc.notes, path, value);
    return {
      notes,
      stamps: { ...doc.stamps, [stampKey(path)]: { path, at, device } },
      undo: trim([...doc.undo, { path, before: box(before), after: box(value), at }]),
      redo: []
    };
  }

  // Undoes the last change. The change is undone as a new change, so it can be redone and it counts for merging.
  function undo(doc, { at = Date.now(), device = '' } = {}) {
    if (!doc.undo.length) return doc;
    const last = doc.undo[doc.undo.length - 1];
    const notes = setPath(doc.notes, last.path, unbox(last.before));
    return {
      notes,
      stamps: { ...doc.stamps, [stampKey(last.path)]: { path: last.path, at, device } },
      undo: doc.undo.slice(0, -1),
      redo: [...doc.redo, last]
    };
  }

  // Redoes the last undone change.
  function redo(doc, { at = Date.now(), device = '' } = {}) {
    if (!doc.redo.length) return doc;
    const last = doc.redo[doc.redo.length - 1];
    const notes = setPath(doc.notes, last.path, unbox(last.after));
    return {
      notes,
      stamps: { ...doc.stamps, [stampKey(last.path)]: { path: last.path, at, device } },
      undo: trim([...doc.undo, last]),
      redo: doc.redo.slice(0, -1)
    };
  }

  // Joins two copies of a song, against the copy both last agreed on (base; empty if there is none). A field changed
  // on only one side takes that side's change. A field changed on both sides takes the later change, and is listed in
  // `overwritten` when the two values differ, so the app can say so instead of losing it silently.
  function merge(local, remote, base = { stamps: {}, notes: {} }) {
    let notes = local.notes;
    const stamps = { ...local.stamps };
    const overwritten = [];
    const keys = new Set([...Object.keys(local.stamps), ...Object.keys(remote.stamps)]);
    for (const k of keys) {
      const bs = base.stamps[k];
      const ls = local.stamps[k];
      const rs = remote.stamps[k];
      const localChanged = !same(ls, bs);
      const remoteChanged = !same(rs, bs);
      if (!remoteChanged) continue;   // only the local copy, or neither, changed it
      const path = (rs || ls).path;
      if (!localChanged) {
        notes = setPath(notes, path, getPath(remote.notes, path));
        stamps[k] = rs;
        continue;
      }
      const localValue = getPath(local.notes, path);
      const remoteValue = getPath(remote.notes, path);
      if (!same(localValue, remoteValue)) overwritten.push(path);
      if (rs.at > ls.at) {
        notes = setPath(notes, path, remoteValue);
        stamps[k] = rs;
      }
    }
    return { notes, stamps, undo: local.undo, redo: local.redo, overwritten };
  }

  // The notes as content: without the bookkeeping (the edit stamps, and the time of the last save).
  const content = (notes) => { const { edits, updatedAt, ...rest } = notes || {}; return rest; };
  const stampsOf = (copy) => (copy && copy.edits && copy.edits.stamps) || {};

  const isPlain = (v) => isObj(v) && !Array.isArray(v);

  // The paths where a and b differ. Objects are compared key by key; anything else (including arrays) as a whole.
  function diff(a, b, path = [], out = []) {
    if (same(a, b)) return out;
    if (isPlain(a) && isPlain(b)) {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], [...path, k], out);
      return out;
    }
    out.push(path);
    return out;
  }

  // Stamps each field of next that differs from base as changed at `at` by `device`. base and next are { notes, stamps }.
  function stampChanges(base, next, { at = Date.now(), device = '' } = {}) {
    const stamps = { ...next.stamps };
    for (const path of diff(content(base.notes), content(next.notes))) stamps[stampKey(path)] = { path, at, device };
    return { notes: next.notes, stamps };
  }

  // A copy as stored in a file or on this phone: the content, the time, and the stamps.
  const record = (doc, updatedAt) => ({ ...content(doc.notes), updatedAt, edits: { stamps: doc.stamps } });

  // The file for a song: the notes, and the edit history.
  function toFile(doc) {
    return { ...doc.notes, edits: { stamps: doc.stamps, undo: doc.undo } };
  }

  // Reads the file back. Missing history gives an empty one, so an older file still opens.
  function fromFile(file) {
    const { edits, ...notes } = file || {};
    return {
      notes,
      stamps: (edits && edits.stamps) || {},
      undo: Array.isArray(edits && edits.undo) ? edits.undo : [],
      redo: []
    };
  }

  // One undoable step: what changed between two copies of the notes, with the value before and after each field.
  // Returns null when nothing changed.
  function step(prev, next, at = Date.now()) {
    const changes = diff(content(prev), content(next)).map((path) => ({
      path,
      before: box(getPath(content(prev), path)),
      after: box(getPath(content(next), path))
    }));
    return changes.length ? { at, changes } : null;
  }

  // The notes with a step applied, backwards ('undo': the before values) or forwards ('redo': the after values).
  function applyStep(notes, st, direction) {
    let out = content(notes);
    for (const c of st.changes) out = setPath(out, c.path, unbox(direction === 'undo' ? c.before : c.after));
    return out;
  }

  // Keeps the newest steps within the count and size limits.
  const trimSteps = (steps) => trim(steps);

  SM.edits = { UNDO_LIMIT, UNDO_BYTES, getPath, setPath, create, setField, undo, redo, merge, toFile, fromFile, content, stampsOf, diff, stampChanges, record, step, applyStep, trimSteps };
})(typeof window !== 'undefined' ? window : globalThis);
