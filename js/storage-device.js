/* Storage on this device (IndexedDB), the songs published with the site, and the copies of band songs kept
   here for offline use. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};
  const { NOTES_SUFFIX, SONG_EXT } = SM.storeCore;

  /* ---------------- this device (IndexedDB) ---------------- */
  // Uses the database created by the first version of the app, so songs added then are kept.
  const local = (() => {
    let p;
    const open = () => p || (p = new Promise((res, rej) => {
      const r = indexedDB.open('bass-map', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('songs', { keyPath: 'id' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const tx = (mode, fn) => open().then((d) => new Promise((res, rej) => {
      const t = d.transaction('songs', mode);
      const req = fn(t.objectStore('songs'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    }));
    const notesOf = (rec) => rec.notes || {
      format: 'setcards/1', title: rec.title, artist: rec.artist,
      sections: Array.isArray(rec.sections) ? rec.sections : null,
      chords: rec.chords || {}, youtubeUrl: rec.youtubeUrl || '', updatedAt: rec.updatedAt || 0
    };
    return {
      id: 'local',
      label: 'On this device',
      canWrite: true,
      available: () => typeof indexedDB !== 'undefined',
      async list() {
        const all = await tx('readonly', (s) => s.getAll());
        return all.map((r) => {
          const n = notesOf(r);
          return { id: r.id, title: n.title || r.title, artist: n.artist || r.artist, fileName: r.fileName, updatedAt: r.updatedAt || 0, addedAt: r.addedAt || r.updatedAt || 0, isDemo: !!r.isDemo, notes: n, canShare: !r.tex, hasTab: !!(r.data || r.tex) };
        });
      },
      async open(id) {
        const r = await tx('readonly', (s) => s.get(id));
        if (!r) throw new Error('Song not found on this device');
        return { bytes: r.data ? new Uint8Array(r.data) : null, tex: r.tex || null, notes: notesOf(r), title: r.title, artist: r.artist, fileName: r.fileName };
      },
      async saveNotes(id, notes) {
        const r = await tx('readonly', (s) => s.get(id));
        if (!r) return;
        r.notes = notes;
        r.title = notes.title || r.title;
        r.artist = notes.artist || r.artist;
        r.updatedAt = Date.now();
        await tx('readwrite', (s) => s.put(r));
      },
      async add(fileName, bytes, notes, meta) {
        const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        await tx('readwrite', (s) => s.put({
          id, title: meta.title, artist: meta.artist, fileName,
          data: bytes ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : null,
          tex: meta.tex || null, isDemo: !!meta.isDemo, notes, addedAt: Date.now(), updatedAt: Date.now()
        }));
        return id;
      },
      // Puts a changed Guitar Pro file in place of the song's file, for notes edited in the tab.
      async replaceTab(id, bytes, fileName) {
        const r = await tx('readonly', (s) => s.get(id));
        if (!r) throw new Error('Song not found on this device');
        r.data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        if (fileName) r.fileName = fileName;
        r.updatedAt = Date.now();
        await tx('readwrite', (s) => s.put(r));
      },
      // Gives a tab-less song its Guitar Pro file; the id stays the same.
      async attachTab(id, fileName, bytes, notes) {
        const r = await tx('readonly', (s) => s.get(id));
        if (!r) throw new Error('Song not found on this device');
        r.data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        r.fileName = fileName;
        r.notes = notes;
        r.updatedAt = Date.now();
        await tx('readwrite', (s) => s.put(r));
        return id;
      },
      remove: (id) => tx('readwrite', (s) => s.delete(id))
    };
  })();

  /* ---------------- songs published with the site (read only) ---------------- */
  // songs/index.json: { "songs": [ { "file": "smooth-operator.gp", "title": "…", "artist": "…" } ] }
  // Notes for a song can sit next to it as "<file>.setcards.json".
  const site = (() => {
    let index = null;
    async function loadIndex() {
      if (index) return index;
      try {
        const r = await fetch('songs/index.json', { cache: 'no-cache' });
        index = r.ok ? ((await r.json()).songs || []) : [];
      } catch (e) { index = []; }
      return index;
    }
    return {
      id: 'site',
      label: 'Shared with the app',
      canWrite: false,
      available: () => true,
      async list() {
        return (await loadIndex()).map((s) => ({ id: s.file, title: s.title || s.file.replace(SONG_EXT, ''), artist: s.artist || '', fileName: s.file, updatedAt: 0 }));
      },
      async open(id) {
        const entry = (await loadIndex()).find((s) => s.file === id) || { file: id };
        const r = await fetch('songs/' + encodeURI(entry.data || id));
        if (!r.ok) throw new Error('Could not download ' + id);
        let bytes;
        if (entry.data && /\.json$/.test(entry.data)) {
          const b64 = (await r.json()).base64;
          bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        } else {
          bytes = new Uint8Array(await r.arrayBuffer());
        }
        let notes = null;
        try {
          const n = await fetch('songs/' + encodeURI(id + NOTES_SUFFIX), { cache: 'no-cache' });
          if (n.ok) notes = await n.json();
        } catch (e) { /* no notes yet */ }
        return { bytes, notes, title: entry.title, artist: entry.artist, fileName: id };
      }
    };
  })();

  /* ---------------- copies kept on this device ---------------- */
  // Band songs are copied here in the background, so they still open when the connection fails.
  // IndexedDB in the browser; a plain map where there is none (tests).
  const offline = (() => {
    const mem = new Map();
    let p;
    const open = () => p || (p = new Promise((res, rej) => {
      const r = indexedDB.open('setcards-offline', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('items', { keyPath: 'k' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const tx = (mode, fn) => open().then((d) => new Promise((res, rej) => {
      const t = d.transaction('items', mode);
      const req = fn(t.objectStore('items'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    }));
    const hasIdb = () => typeof indexedDB !== 'undefined';
    return {
      get: (k) => (hasIdb() ? tx('readonly', (st) => st.get(k)) : Promise.resolve(mem.get(k))),
      put: (item) => (hasIdb() ? tx('readwrite', (st) => st.put(item)) : Promise.resolve(void mem.set(item.k, item))),
      del: (k) => (hasIdb() ? tx('readwrite', (st) => st.delete(k)) : Promise.resolve(void mem.delete(k)))
    };
  })();


  SM.storeDevice = { offline, local, site };
})(typeof window !== 'undefined' ? window : globalThis);
