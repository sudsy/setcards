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
  const { NOTES_SUFFIX, SONG_EXT, emptyNotes, overlay } = SM.storeCore;
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

  // Set lists kept on this device, for solo use and for a band before its folder is connected. Each is one entry.
  const setlistDevice = (() => {
    const KEY = 'setcards:setlists';
    const readAll = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
    const writeAll = (all) => { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* storage full or off */ } };
    return {
      async list() {
        const all = readAll();
        return Object.keys(all).map((id) => ({ id, list: SM.setlists.parse(all[id]) })).filter((x) => x.list);
      },
      async write(id, list) {
        const all = readAll();
        const nid = id || `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
        all[nid] = SM.setlists.serialise(list);
        writeAll(all);
        return nid;
      },
      async remove(id) {
        const all = readAll();
        delete all[id];
        writeAll(all);
      }
    };
  })();

  const library = {
    sources,
    setlistDevice,
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
        if (ov && (!song.notes || (ov.updatedAt || 0) >= (song.notes.updatedAt || 0))) { song.notes = ov; song.localOnly = !source.canWrite; song.fromOverlay = true; }
        song.notes = Object.assign(emptyNotes(song), song.notes || {});
        song.key = key;
        song.canShare = source.canWrite;
        return song;
      };
      const song = finish(await source.open(id));
      if (song.latest) { const latest = song.latest; song.latest = () => latest().then((fresh) => fresh && finish(fresh)); }
      return song;
    },

    // Saves notes to the song's source, or to this browser if the source is read only or unreachable.
    async saveNotes(key, notes) {
      const { source, id } = library.parse(key);
      notes.updatedAt = Date.now();
      if (!source || !source.canWrite) { overlay.set(key, notes); return { local: true }; }
      try {
        await source.saveNotes(id, notes);
        overlay.clear(key);
        return { local: false };
      } catch (e) {
        overlay.set(key, notes);
        return { local: true, error: e };
      }
    },
    overlay
  };

  SM.library = library;
  SM.NOTES_SUFFIX = NOTES_SUFFIX;
  SM.SONG_EXT = SONG_EXT;
})(typeof window !== 'undefined' ? window : globalThis);
