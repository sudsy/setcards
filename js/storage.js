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
          return { id: r.id, title: n.title || r.title, artist: n.artist || r.artist, fileName: r.fileName, updatedAt: r.updatedAt || 0, isDemo: !!r.isDemo, notes: n, canShare: !r.tex };
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

    async function writeNotes(songName, notes) {
      const f = folder();
      const files = filesCache || await listFolder();
      const name = songName + NOTES_SUFFIX;
      const existing = files.find((x) => x.name === name);
      const json = JSON.stringify(notes, null, 1);
      if (existing) {
        await call(`${UPLOAD}/files/${existing.id}?uploadType=media&supportsAllDrives=true`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: json });
      } else {
        const m = multipart({ name, parents: [f.id], mimeType: 'application/json' }, json, 'application/json');
        const r = await call(`${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name`, { method: 'POST', headers: { 'Content-Type': m.type }, body: m.body });
        files.push(await r.json());
      }
    }

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
        const files = await listFolder();
        const songs = files.filter((x) => SONG_EXT.test(x.name));
        // each song's notes hold its title, key and tempo for the list; they are small, so read them together
        return Promise.all(songs.map(async (x) => {
          const nf = files.find((n) => n.name === x.name + NOTES_SUFFIX);
          let notes = null;
          if (nf) {
            try { notes = await (await call(`${API}/files/${nf.id}?alt=media&supportsAllDrives=true`)).json(); } catch (e) { notes = null; }
          }
          return {
            id: x.id, title: (notes && notes.title) || x.name.replace(SONG_EXT, '').replace(/[_-]+/g, ' '), artist: (notes && notes.artist) || '',
            fileName: x.name, updatedAt: Date.parse(x.modifiedTime) || 0, notes
          };
        }));
      },
      async open(id) {
        const files = filesCache || await listFolder();
        const meta = files.find((x) => x.id === id) || (await (await call(`${API}/files/${id}?fields=id,name&supportsAllDrives=true`)).json());
        const bytes = new Uint8Array(await (await call(`${API}/files/${id}?alt=media&supportsAllDrives=true`)).arrayBuffer());
        let notes = null;
        const nf = files.find((x) => x.name === meta.name + NOTES_SUFFIX);
        if (nf) {
          try { notes = await (await call(`${API}/files/${nf.id}?alt=media&supportsAllDrives=true`)).json(); } catch (e) { notes = null; }
        }
        return { bytes, notes, title: notes && notes.title, artist: notes && notes.artist, fileName: meta.name };
      },
      async saveNotes(id, notes) {
        const files = filesCache || await listFolder();
        const meta = files.find((x) => x.id === id);
        if (!meta) throw new Error('This song is no longer in the band folder');
        await writeNotes(meta.name, notes);
      },
      async add(fileName, bytes, notes) {
        const f = folder();
        const m = multipart({ name: fileName, parents: [f.id] }, bytes, 'application/octet-stream');
        const r = await call(`${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,modifiedTime`, { method: 'POST', headers: { 'Content-Type': m.type }, body: m.body });
        const created = await r.json();
        (filesCache || (filesCache = [])).push(created);
        await writeNotes(fileName, notes);
        return created.id;
      },
      async remove(id) {
        const files = filesCache || await listFolder();
        const meta = files.find((x) => x.id === id);
        await call(`${API}/files/${id}?supportsAllDrives=true`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
        const nf = meta && files.find((x) => x.name === meta.name + NOTES_SUFFIX);
        if (nf) await call(`${API}/files/${nf.id}?supportsAllDrives=true`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
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
