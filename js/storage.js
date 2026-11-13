/* Setcards storage: one library made of interchangeable sources.

   Every source implements the same small interface, so adding Supabase, GitHub or anything else later
   means writing one more source object and registering it in SM.library:

     id, label                 short id used in song keys ("local", "site", "drive") and a display name
     available()               true when the source is set up and usable right now
     canWrite                  true if notes and new songs can be saved back to it
     list()                    -> [{ id, title, artist, fileName, updatedAt }]
     open(id)                  -> { bytes?: Uint8Array, tex?: string, notes: object|null, title, artist, fileName }
     saveNotes(id, notes)      stores the shared notes (sections, chords…) for a song
     add(fileName, bytes, notes, meta) -> id      (only when canWrite)
     remove(id)                (only when canWrite)

   "Notes" are everything the band adds on top of the Guitar Pro file. They are plain JSON:
     { format: 'setcards/1', title, artist, sections: [{ id, start, name, unit?, videoTime? }],
       chords: { "<bar index>": "Dm Am7" }, youtubeUrl, updatedAt }
   Sources that cannot write keep edits in this browser as an overlay, so nothing is lost. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};
  const { NOTES_SUFFIX, SONG_EXT, emptyNotes, overlay, ls } = SM.storeCore;
  const { local, site } = SM.storeDevice;
  const { drive } = SM.storeDrive;

  /* ---------------- the library ---------------- */
  const sources = { local, site, drive };

  // MP3s for songs, kept on this device so they play offline.
  const audioStore = (() => {
    let db = null;
    const open = () => db || (db = new Promise((res, rej) => {
      const r = indexedDB.open('setcards-audio', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('clips', { keyPath: 'k' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const tx = (mode, fn) => open().then((d) => new Promise((res, rej) => {
      const t = d.transaction('clips', mode);
      const req = fn(t.objectStore('clips'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    }));
    return {
      get: (k) => tx('readonly', (s) => s.get(k)),
      put: (rec) => tx('readwrite', (s) => s.put(rec)),
      del: (k) => tx('readwrite', (s) => s.delete(k))
    };
  })();

  // An MP3 for a song. This device keeps a copy. A band song also keeps it in its Drive folder, so the others can play it.
  const audio = {
    async save(key, name, bytes) {
      const { source, id } = library.parse(key);
      if (!source.canWrite) throw new Error('This copy of the song is read-only here.');
      const fileId = source.uploadAudio ? await source.uploadAudio(id, name, bytes) : null;
      await audioStore.put({ k: key, name, fileId, bytes, type: 'audio/mpeg' });
      return { name, fileId };
    },
    // The copy on this device, or the file from the band's folder when this device does not have it yet.
    async load(key, meta) {
      if (!meta) return null;
      const copy = await audioStore.get(key);
      if (copy && copy.name === meta.name && copy.fileId === (meta.fileId || null)) return copy;
      const { source } = library.parse(key);
      if (!meta.fileId || !source.downloadAudio) return null;
      const rec = { k: key, name: meta.name, fileId: meta.fileId, bytes: await source.downloadAudio(meta.fileId), type: 'audio/mpeg' };
      await audioStore.put(rec).catch(() => {});
      return rec;
    },
    // Takes the file out of the band's folder (a replaced MP3 is discarded this way).
    async discard(key, meta) {
      if (!meta || !meta.fileId) return;
      const { source } = library.parse(key);
      if (source.trashAudio) await source.trashAudio(meta.fileId);
    },
    async remove(key, meta) {
      await audio.discard(key, meta);
      await audioStore.del(key).catch(() => {});
    }
  };

  // Drum kits. A band keeps them in its folder; on a device they are kept here. Either way a copy is kept on this device,
  // so a kit a song uses still loads when there is no connection.
  const kitKey = (name, fileId) => `kit:${fileId || name}`;
  const kits = {
    async list(key) {
      const { source } = library.parse(key);
      if (source.listDrumKits) return source.listDrumKits();
      const idx = await audioStore.get('kits-index').catch(() => null);
      return idx ? idx.names.map((name) => ({ name, fileId: null })) : [];
    },
    async add(key, name, bytes) {
      const { source } = library.parse(key);
      if (!source.canWrite) throw new Error('This copy of the song is read-only here.');
      let fileId = null;
      if (source.uploadDrumKit) {
        fileId = await source.uploadDrumKit(name, bytes);
      } else {
        const idx = (await audioStore.get('kits-index').catch(() => null)) || { k: 'kits-index', names: [] };
        if (!idx.names.includes(name)) idx.names.push(name);
        await audioStore.put(idx);
      }
      await audioStore.put({ k: kitKey(name, fileId), name, fileId, bytes, type: 'application/octet-stream' });
      return { name, fileId };
    },
    // The kit's bytes, from this device when it has them, otherwise from the band folder.
    async load(key, meta) {
      const copy = await audioStore.get(kitKey(meta.name, meta.fileId)).catch(() => null);
      if (copy) return copy.bytes;
      const { source } = library.parse(key);
      if (!meta.fileId || !source.downloadDrumKit) return null;
      const bytes = await source.downloadDrumKit(meta.fileId);
      await audioStore.put({ k: kitKey(meta.name, meta.fileId), name: meta.name, fileId: meta.fileId, bytes, type: 'application/octet-stream' }).catch(() => {});
      return bytes;
    }
  };

  // Set lists kept on this phone, one store for each place (a band folder, or solo use). Each set list is a record:
  // { id, list, driveId, dirty, deleted }. Changes are kept here at once; a band's changes go to its folder on refresh.
  const setlistLocal = (ns) => {
    const KEY = `setcards:setlists:${ns}`;
    const readAll = () => { try { const o = JSON.parse(localStorage.getItem(KEY)); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
    const writeAll = (all) => { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* storage full or off */ } };
    return {
      all() { const a = readAll(); return Object.keys(a).map((id) => ({ id, ...a[id] })); },
      put(rec) { const a = readAll(); const { id, ...rest } = rec; a[id] = rest; writeAll(a); return rec; },
      del(id) { const a = readAll(); delete a[id]; writeAll(a); },
      newId: () => `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
    };
  };

  // The copy each song last agreed on with the band's folder (its content and stamps), kept on this phone.
  const synced = {
    get: (key) => { const r = ls.get('setcards:synced:' + key); return r && r.edits ? r : null; },
    set: (key, rec) => ls.set('setcards:synced:' + key, rec)
  };

  // A random id for this device, so each change says which device made it.
  const deviceId = () => {
    let d = ls.get('setcards:device');
    if (!d) { d = Math.random().toString(36).slice(2, 10); ls.set('setcards:device', d); }
    return d;
  };

  // Works out the copy to show for a song: the band's copy, this phone's unsent edits, or both merged field by field.
  // Writes the agreed copy and the phone's copy, and keeps the band's version aside when a field changed in both places.
  function agree(key, remoteNotes, ov) {
    const remoteAt = remoteNotes.updatedAt || 0;
    const base = synced.get(key);
    let baseDoc = base ? { notes: SM.edits.content(base), stamps: SM.edits.stampsOf(base) } : null;
    let remote = { notes: SM.edits.content(remoteNotes), stamps: SM.edits.stampsOf(remoteNotes) };
    // every field of the band's copy that differs from the agreed copy is a change made at the copy's time, whatever
    // stamps it carries (a copy from before stamps existed has none)
    if (baseDoc) remote = SM.edits.stampChanges(baseDoc, remote, { at: remoteAt, device: 'band' });
    if (!baseDoc) baseDoc = { notes: remote.notes, stamps: remote.stamps };
    // a conflict stays flagged until its versions have been looked at and cleared (its record is kept until then)
    const pending = () => !!ls.get('setcards:conflict:' + key);
    const agreed = (doc) => { const rec = SM.edits.record(doc, remoteAt); synced.set(key, rec); return { notes: { ...SM.edits.content(doc.notes), updatedAt: remoteAt }, conflict: pending(), kept: false }; };
    if (!ov) return agreed(remote);
    const local = { notes: SM.edits.content(ov), stamps: SM.edits.stampsOf(ov) };
    const localChanged = SM.edits.diff(baseDoc.notes, local.notes).length > 0;
    const remoteChanged = SM.edits.diff(baseDoc.notes, remote.notes).length > 0;
    if (!localChanged) { overlay.clear(key); return agreed(remote); }
    if (!remoteChanged) return { notes: { ...local.notes, updatedAt: ov.updatedAt }, conflict: pending(), kept: true };
    // both changed: each field takes the later change; a field changed in both places is listed and the other version is kept
    const m = SM.edits.merge(local, remote, baseDoc);
    const conflict = m.overwritten.length > 0 || pending();
    // both versions are kept, so whichever field lost can still be seen
    if (m.overwritten.length) ls.set('setcards:conflict:' + key, { local: local.notes, remote: remote.notes, at: Date.now() });
    overlay.set(key, SM.edits.record({ notes: m.notes, stamps: m.stamps }, ov.updatedAt));
    return { notes: { ...m.notes, updatedAt: ov.updatedAt }, conflict, kept: true };
  }

  const library = {
    sources,
    synced,
    setlistLocal,
    kits,
    audio,
    key: (sourceId, id) => `${sourceId}:${id}`,
    parse(key) { const i = key.indexOf(':'); return { source: sources[key.slice(0, i)], sourceId: key.slice(0, i), id: key.slice(i + 1) }; },
    emptyNotes,

    async open(key) {
      const { source, id } = library.parse(key);
      if (!source) throw new Error('Unknown song source');
      const finish = (song) => {
        const ov = overlay.get(key);
        if (source.canWrite) {
          const r = agree(key, song.notes || {}, ov);
          song.notes = r.notes;
          song.conflict = r.conflict;
          if (r.kept) song.fromOverlay = true;
        } else if (ov && (!song.notes || (ov.updatedAt || 0) >= ((song.notes && song.notes.updatedAt) || 0))) {
          song.notes = ov; song.localOnly = true; song.fromOverlay = true;
        }
        song.notes = Object.assign(emptyNotes(song), song.notes || {});
        delete song.notes.edits;
        song.key = key;
        song.canShare = source.canWrite;
        return song;
      };
      const song = finish(await source.open(id));
      if (song.latest) { const latest = song.latest; song.latest = () => latest().then((fresh) => fresh && finish(fresh)); }
      return song;
    },

    // Records a change on this phone, at once. Each field that differs from the agreed copy is stamped with the time
    // and the device. Returns the record to keep on this phone, and to send to the band's folder.
    stage(key, notes) {
      const now = Date.now();
      const base = synced.get(key);
      const kept = overlay.get(key);
      const baseDoc = base ? { notes: SM.edits.content(base), stamps: SM.edits.stampsOf(base) } : { notes: {}, stamps: {} };
      const from = { notes: SM.edits.content(notes), stamps: SM.edits.stampsOf(kept || base) };
      const doc = SM.edits.stampChanges(baseDoc, from, { at: now, device: deviceId() });
      notes.updatedAt = now;
      const rec = SM.edits.record(doc, now);
      overlay.set(key, rec);
      return rec;
    },

    // Saves notes to the song's source, or to this browser if the source is read only or unreachable. The copy on this
    // phone is always kept first, so an edit is not lost when the band's folder cannot be reached.
    async saveNotes(key, notes) {
      const { source, id } = library.parse(key);
      const rec = library.stage(key, notes);
      if (!source || !source.canWrite) return { local: true };
      try {
        await source.saveNotes(id, { ...rec });
        synced.set(key, rec);
        // cleared only when nothing newer was changed while the save was in progress
        const now = overlay.get(key);
        if (now && now.updatedAt === rec.updatedAt) overlay.clear(key);
        return { local: false };
      } catch (e) {
        return { local: true, error: e };
      }
    },
    overlay
  };

  SM.library = library;
  SM.NOTES_SUFFIX = NOTES_SUFFIX;
  SM.SONG_EXT = SONG_EXT;
})(typeof window !== 'undefined' ? window : globalThis);
