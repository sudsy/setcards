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

  const NOTES_SUFFIX = '.setcards.json';
  const SONG_EXT = /\.(gp|gpx|gp[345]|xml|musicxml|mxl|capx)$/i;

  function emptyNotes(meta) {
    return { format: 'setcards/1', title: meta.title || '', artist: meta.artist || '', sections: null, chords: {}, youtubeUrl: '', updatedAt: 0 };
  }

  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } }
  };

  // Edits to songs in read-only sources, kept in this browser.
  const overlay = {
    get: (key) => ls.get('setcards:overlay:' + key),
    set: (key, notes) => ls.set('setcards:overlay:' + key, notes),
    clear: (key) => ls.del('setcards:overlay:' + key)
  };

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
          return { id: r.id, title: n.title || r.title, artist: n.artist || r.artist, fileName: r.fileName, updatedAt: r.updatedAt || 0, isDemo: !!r.isDemo, notes: n, canShare: !r.tex, hasTab: !!(r.data || r.tex) };
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

  /* ---------------- Google Drive ---------------- */
  // Each person signs in with their own Google account and picks the band's shared folder.
  // Songs and notes live in that folder; nothing is stored on any server of ours.
  // Uses the drive.file permission, which only covers files this app created or the person picked,
  // so files added straight into Drive by someone else show up as "needs access" until picked once.
  const drive = (() => {
    const cfg = () => Object.assign({}, root.SETCARDS_CONFIG && root.SETCARDS_CONFIG.google, ls.get('setcards:google') || {});
    const folder = () => ls.get('setcards:driveFolder');   // { id, name }
    let token = null;
    let tokenExpiry = 0;
    let tokenClient = null;
    let scriptsReady = null;
    const API = 'https://www.googleapis.com/drive/v3';
    const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
    let filesCache = null;   // last listing of the folder

    function loadScript(src) {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const s = document.createElement('script');
        s.src = src; s.async = true; s.onload = resolve; s.onerror = () => reject(new Error('Could not reach Google'));
        document.head.appendChild(s);
      });
    }
    function ready() {
      if (!scriptsReady) {
        scriptsReady = Promise.all([loadScript('https://accounts.google.com/gsi/client'), loadScript('https://apis.google.com/js/api.js')])
          .then(() => new Promise((res) => root.gapi.load('picker', res)));
        scriptsReady.catch(() => { scriptsReady = null; });
      }
      return scriptsReady;
    }

    // Asks Google for an access token. Must start from a tap the first time (Google shows a pop-up).
    // The access token lasts an hour; it is kept for this browser tab so a reload doesn't ask again.
    const saved = (() => { try { return JSON.parse(sessionStorage.getItem('setcards:gtoken')); } catch (e) { return null; } })();
    if (saved && saved.exp > Date.now() + 60000) { token = saved.token; tokenExpiry = saved.exp; }
    const hasToken = () => !!token && Date.now() < tokenExpiry - 60000;

    async function signIn(interactive) {
      if (hasToken()) return token;
      const c = cfg();
      if (!c.clientId) throw new Error('Google Drive is not set up for this copy of Setcards yet');
      await ready();
      return new Promise((resolve, reject) => {
        tokenClient = root.google.accounts.oauth2.initTokenClient({
          client_id: c.clientId,
          scope: 'https://www.googleapis.com/auth/drive.file',
          prompt: interactive ? '' : 'none',
          hint: ls.get('setcards:googleHint') || undefined,
          callback: (resp) => {
            if (resp.error) return reject(new Error(resp.error_description || resp.error));
            token = resp.access_token;
            tokenExpiry = Date.now() + (resp.expires_in || 3600) * 1000;
            try { sessionStorage.setItem('setcards:gtoken', JSON.stringify({ token, exp: tokenExpiry })); } catch (e) { /* storage unavailable */ }
            // remember which account was used, so the next sign-in can skip Google's account chooser
            fetch(`${API}/about?fields=user(emailAddress)`, { headers: { Authorization: 'Bearer ' + token } })
              .then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.user) ls.set('setcards:googleHint', j.user.emailAddress); }).catch(() => {});
            ls.set('setcards:driveSignedIn', true);
            resolve(token);
          },
          error_callback: (err) => reject(new Error(err && err.message ? err.message : 'Sign-in was cancelled'))
        });
        tokenClient.requestAccessToken();
      });
    }

    async function call(url, opts = {}) {
      const t = await signIn(true);
      const r = await fetch(url, Object.assign({}, opts, { headers: Object.assign({ Authorization: 'Bearer ' + t }, opts.headers || {}) }));
      if (r.status === 401) {
        token = null;
        try { sessionStorage.removeItem('setcards:gtoken'); } catch (e) { /* storage unavailable */ }
        throw new Error('Your Google sign-in expired. Open Songs and tap Show band songs to sign in again.');
      }
      if (!r.ok) throw new Error(`Google Drive said ${r.status}: ${(await r.text()).slice(0, 160)}`);
      return r;
    }

    // Opens Google's own file picker. mode 'folder' picks the band folder itself (only `onlyId` when joining
    // from an invite link); mode 'files' picks songs inside the band folder.
    async function pick(mode, onlyId) {
      const t = await signIn(true);
      const c = cfg();
      await ready();
      const P = root.google.picker;
      return new Promise((resolve) => {
        const views = [];
        if (mode === 'folder') {
          const folders = () => new P.DocsView(P.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes('application/vnd.google-apps.folder');
          if (onlyId && typeof P.DocsView.prototype.setFileIds === 'function') {
            views.push(folders().setFileIds(onlyId).setLabel('Band folder'));
          } else {
            views.push(folders().setOwnedByMe(true).setLabel('My Drive'));
            views.push(folders().setOwnedByMe(false).setLabel('Shared with me'));
            views.push(folders().setEnableDrives(true).setLabel('Shared drives'));
          }
        } else {
          const view = new P.DocsView(P.ViewId.DOCS).setIncludeFolders(false);
          const f = folder();
          if (f) view.setParent(f.id);
          views.push(view);
        }
        const builder = new P.PickerBuilder().setOAuthToken(t)
          .enableFeature(P.Feature.SUPPORT_DRIVES)
          .setCallback((data) => {
            if (data.action === P.Action.PICKED) resolve(data.docs.map((d) => ({ id: d.id, name: d.name })));
            else if (data.action === P.Action.CANCEL) resolve([]);
          });
        if (mode !== 'folder') builder.enableFeature(P.Feature.MULTISELECT_ENABLED).setTitle('Select the songs to open in Setcards');
        else builder.setTitle(onlyId ? 'Tap the band folder, then Select' : 'Pick your band folder');
        views.forEach((v) => builder.addView(v));
        if (c.apiKey) builder.setDeveloperKey(c.apiKey);
        if (c.appId) builder.setAppId(c.appId);
        builder.build().setVisible(true);
      });
    }

    async function listFolder() {
      const f = folder();
      if (!f) return [];
      const q = encodeURIComponent(`'${f.id}' in parents and trashed = false`);
      const r = await call(`${API}/files?q=${q}&fields=files(id,name,modifiedTime,size)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`);
      filesCache = (await r.json()).files || [];
      return filesCache;
    }

    function multipart(meta, body, type) {
      const boundary = 'setcards' + Math.random().toString(36).slice(2);
      const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${type}\r\n\r\n`;
      const tail = `\r\n--${boundary}--`;
      return { body: new Blob([head, body, tail]), type: `multipart/related; boundary=${boundary}` };
    }

    // Songs in the folder. A song is its notes file, its Guitar Pro file, or both:
    // a song added before it has tab is just "<name>.setcards.json"; once a tab file is attached the notes
    // say which file it is (notes.tabFile). Older notes sit next to their tab as "<tab file>.setcards.json".
    // A song's id is its tab file's id, or "n:<notes file id>" while it has no tab.
    function noteEntries(files) {
      return files.filter((x) => x.name.endsWith(NOTES_SUFFIX)).map((nf) => {
        const base = nf.name.slice(0, -NOTES_SUFFIX.length);
        return { notesFile: nf, tabName: SONG_EXT.test(base) ? base : null };
      });
    }
    async function readNotes(nf) {
      try { return await (await call(`${API}/files/${nf.id}?alt=media&supportsAllDrives=true`)).json(); } catch (e) { return null; }
    }
    // Resolves every song in the folder, reading notes so tab-less songs can be matched to tab files named in them.
    async function allSongs() {
      const files = filesCache || await listFolder();
      const entries = noteEntries(files);
      const notesList = await Promise.all(entries.map((e) => readNotes(e.notesFile)));
      const songs = [];
      const tabTaken = new Set();
      entries.forEach((e, i) => {
        const notes = notesList[i];
        const tabName = (notes && notes.tabFile) || e.tabName;
        const tab = tabName ? files.find((x) => x.name === tabName && SONG_EXT.test(x.name)) : null;
        if (tab) tabTaken.add(tab.id);
        songs.push({ id: tab ? tab.id : 'n:' + e.notesFile.id, tab, notesFile: e.notesFile, notes, modified: (tab || e.notesFile).modifiedTime });
      });
      files.filter((x) => SONG_EXT.test(x.name) && !tabTaken.has(x.id)).forEach((tab) => {
        songs.push({ id: tab.id, tab, notesFile: null, notes: null, modified: tab.modifiedTime });
      });
      return songs;
    }
    async function findSong(id) {
      const songs = await allSongs();
      const song = songs.find((x) => x.id === id);
      if (!song) throw new Error('This song is no longer in the band folder');
      return song;
    }
    const slug = (t) => (t || 'song').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80) || 'song';

    async function writeNotesFile(song, notes, nameIfNew) {
      const f = folder();
      const json = JSON.stringify(notes, null, 1);
      if (song && song.notesFile) {
        // Drive drops old versions after 30 days; the first save each day is kept for good.
        const today = new Date().toISOString().slice(0, 10);
        const keptKey = 'setcards:kept:' + song.notesFile.id;
        const keep = ls.get(keptKey) !== today;
        await call(`${UPLOAD}/files/${song.notesFile.id}?uploadType=media&supportsAllDrives=true${keep ? '&keepRevisionForever=true' : ''}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: json });
        if (keep) ls.set(keptKey, today);
        return song.notesFile;
      }
      const m = multipart({ name: nameIfNew + NOTES_SUFFIX, parents: [f.id], mimeType: 'application/json' }, json, 'application/json');
      const r = await call(`${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,modifiedTime`, { method: 'POST', headers: { 'Content-Type': m.type }, body: m.body });
      const created = await r.json();
      (filesCache || (filesCache = [])).push(created);
      return created;
    }
    async function uploadTab(fileName, bytes) {
      const f = folder();
      const m = multipart({ name: fileName, parents: [f.id] }, bytes, 'application/octet-stream');
      const r = await call(`${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,modifiedTime`, { method: 'POST', headers: { 'Content-Type': m.type }, body: m.body });
      const created = await r.json();
      (filesCache || (filesCache = [])).push(created);
      return created;
    }
    const trash = (id) => call(`${API}/files/${id}?supportsAllDrives=true`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });

    return {
      id: 'drive',
      label: 'Band folder (Google Drive)',
      canWrite: true,
      configured: () => !!cfg().clientId,
      connected: () => !!folder(),
      signedIn: hasToken,
      signIn: () => signIn(true),
      folder,
      available: () => !!cfg().clientId && !!folder(),
      setClient(c) { ls.set('setcards:google', c); },
      async connect(onlyId) {
        const picked = await pick('folder', onlyId);
        if (!picked.length) return null;
        ls.set('setcards:driveFolder', picked[0]);
        filesCache = null;
        return picked[0];
      },
      async createFolder(name) {
        const r = await call(`${API}/files?fields=id,name&supportsAllDrives=true`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' })
        });
        const f = await r.json();
        ls.set('setcards:driveFolder', { id: f.id, name: f.name });
        filesCache = [];
        return f;
      },
      disconnect() {
        ls.del('setcards:driveFolder');
        filesCache = null;
        token = null;
        try { sessionStorage.removeItem('setcards:gtoken'); } catch (e) { /* storage unavailable */ }
      },
      folderUrl: () => (folder() ? `https://drive.google.com/drive/folders/${folder().id}` : null),
      // A link that opens Setcards ready to join this band folder.
      inviteLink() {
        const f = folder();
        if (!f) return null;
        const u = new URL(location.href);
        u.search = '';
        u.hash = '';
        u.searchParams.set('band', f.id);
        u.searchParams.set('name', f.name);
        return u.toString();
      },
      // Lets the person grant access to songs other bandmates dropped into the folder.
      async grantAccess() { const picked = await pick('files'); filesCache = null; return picked.length; },
      async list() {
        filesCache = null;
        const songs = await allSongs();
        return songs.map((s) => ({
          id: s.id,
          title: (s.notes && s.notes.title) || (s.tab ? s.tab.name.replace(SONG_EXT, '').replace(/[_-]+/g, ' ') : 'Untitled'),
          artist: (s.notes && s.notes.artist) || '',
          fileName: s.tab ? s.tab.name : null,
          hasTab: !!s.tab,
          updatedAt: Date.parse(s.modified) || 0,
          notes: s.notes
        }));
      },
      async open(id) {
        const song = await findSong(id);
        const bytes = song.tab ? new Uint8Array(await (await call(`${API}/files/${song.tab.id}?alt=media&supportsAllDrives=true`)).arrayBuffer()) : null;
        const notes = song.notes;
        return { bytes, notes, title: notes && notes.title, artist: notes && notes.artist, fileName: song.tab ? song.tab.name : null };
      },
      async saveNotes(id, notes) {
        const song = await findSong(id);
        if (song.tab && !notes.tabFile) notes.tabFile = song.tab.name;
        await writeNotesFile(song, notes, song.tab ? song.tab.name : slug(notes.title));
      },
      // A song with tab (bytes) or without (bytes null: just the notes).
      async add(fileName, bytes, notes) {
        if (!bytes) {
          const nf = await writeNotesFile(null, notes, slug(`${notes.title}${notes.artist ? ' - ' + notes.artist : ''}`));
          return 'n:' + nf.id;
        }
        const tab = await uploadTab(fileName, bytes);
        notes.tabFile = fileName;
        await writeNotesFile(null, notes, fileName);
        return tab.id;
      },
      // Gives a tab-less song its Guitar Pro file. Returns the song's new id.
      async attachTab(id, fileName, bytes, notes) {
        const song = await findSong(id);
        const tab = await uploadTab(fileName, bytes);
        notes.tabFile = fileName;
        await writeNotesFile(song, notes, fileName);
        return tab.id;
      },
      async remove(id) {
        const song = await findSong(id);
        if (song.tab) await trash(song.tab.id);
        if (song.notesFile) await trash(song.notesFile.id);
        filesCache = null;
      }
    };
  })();

  /* ---------------- the library ---------------- */
  const sources = { local, site, drive };

  const library = {
    sources,
    key: (sourceId, id) => `${sourceId}:${id}`,
    parse(key) { const i = key.indexOf(':'); return { source: sources[key.slice(0, i)], sourceId: key.slice(0, i), id: key.slice(i + 1) }; },
    emptyNotes,

    async open(key) {
      const { source, id } = library.parse(key);
      if (!source) throw new Error('Unknown song source');
      const song = await source.open(id);
      const ov = overlay.get(key);
      if (ov && (!song.notes || (ov.updatedAt || 0) >= (song.notes.updatedAt || 0))) { song.notes = ov; song.localOnly = !source.canWrite; song.fromOverlay = true; }
      song.notes = Object.assign(emptyNotes(song), song.notes || {});
      song.key = key;
      song.canShare = source.canWrite;
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
