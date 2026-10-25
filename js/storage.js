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
  // Uses the full Drive permission, so the band folder and everything in it is visible,
  // so files added straight into Drive by someone else show up as "needs access" until picked once.
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
    let scriptsLoaded = false;
    function ready() {
      if (!scriptsReady) {
        scriptsReady = Promise.all([loadScript('https://accounts.google.com/gsi/client'), loadScript('https://apis.google.com/js/api.js')])
          .then(() => new Promise((res) => root.gapi.load('picker', res)))
          .then(() => { scriptsLoaded = true; });
        scriptsReady.catch(() => { scriptsReady = null; });
      }
      return scriptsReady;
    }
    // Loads Google's scripts when the app starts, so a later tap can open the sign-in popup at once.
    // Safari blocks a popup that opens after a wait, which is what happened when the scripts loaded on the first tap.
    const preload = () => { if (cfg().clientId) ready().catch(() => {}); };

    // Asks Google for an access token. Must start from a tap the first time (Google shows a pop-up).
    // The access token lasts an hour; it is kept for this browser tab so a reload doesn't ask again.
    const saved = (() => { try { return JSON.parse(sessionStorage.getItem('setcards:gtoken2')); } catch (e) { return null; } })();
    if (saved && saved.exp > Date.now() + 60000) { token = saved.token; tokenExpiry = saved.exp; }
    const hasToken = () => !!token && Date.now() < tokenExpiry - 60000;

    async function signIn(interactive) {
      if (hasToken()) return token;
      const c = cfg();
      if (!c.clientId) throw new Error('Google Drive is not set up for this copy of Setcards yet');
      // no await before the sign-in request once the scripts are in, so the popup is opened by the tap
      if (!scriptsLoaded) await ready();
      return new Promise((resolve, reject) => {
        tokenClient = root.google.accounts.oauth2.initTokenClient({
          client_id: c.clientId,
          scope: 'https://www.googleapis.com/auth/drive',
          prompt: interactive ? '' : 'none',
          hint: ls.get('setcards:googleHint') || undefined,
          callback: (resp) => {
            if (resp.error) return reject(new Error(resp.error_description || resp.error));
            token = resp.access_token;
            tokenExpiry = Date.now() + (resp.expires_in || 3600) * 1000;
            try { sessionStorage.setItem('setcards:gtoken2', JSON.stringify({ token, exp: tokenExpiry })); } catch (e) { /* storage unavailable */ }
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
        try { sessionStorage.removeItem('setcards:gtoken2'); } catch (e) { /* storage unavailable */ }
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
      if (!scriptsLoaded) await ready();
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

    // Folder layout: the band folder holds the Song list sheet and a "Tabs" folder, which has a folder
    // per song ("Title - Artist") holding that song's notes and Guitar Pro file.
    const FOLDER_TYPE = 'application/vnd.google-apps.folder';
    const TABS_NAME = 'Tabs';
    let tabsFolder = null;

    // Everything directly inside any of the given folders.
    async function childrenOf(parentIds) {
      const out = [];
      for (let i = 0; i < parentIds.length; i += 40) {
        const q = encodeURIComponent(`(${parentIds.slice(i, i + 40).map((id) => `'${id}' in parents`).join(' or ')}) and trashed = false`);
        let page = '';
        do {
          const r = await call(`${API}/files?q=${q}&fields=nextPageToken,files(id,name,mimeType,modifiedTime,createdTime,size,parents)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${page ? '&pageToken=' + page : ''}`);
          const j = await r.json();
          out.push(...(j.files || []));
          page = j.nextPageToken || '';
        } while (page);
      }
      return out;
    }

    async function listFolder() {
      const f = folder();
      if (!f) return [];
      const top = await childrenOf([f.id]);
      tabsFolder = top.find((x) => x.name === TABS_NAME && x.mimeType === FOLDER_TYPE) || null;
      const songFolders = tabsFolder ? (await childrenOf([tabsFolder.id])).filter((x) => x.mimeType === FOLDER_TYPE) : [];
      const inside = songFolders.length ? await childrenOf(songFolders.map((x) => x.id)) : [];
      filesCache = [...top, ...songFolders, ...inside];
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
    const isFolder = (x) => x.mimeType === FOLDER_TYPE;
    const parentOf = (x) => (x.parents || [])[0];
    function noteEntries(files) {
      return files.filter((x) => !isFolder(x) && x.name.endsWith(NOTES_SUFFIX)).map((nf) => {
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
        // a song's tab sits in the same folder as its notes
        const tab = tabName ? files.find((x) => !isFolder(x) && x.name === tabName && SONG_EXT.test(x.name) && parentOf(x) === parentOf(e.notesFile) && !tabTaken.has(x.id)) : null;
        if (tab) tabTaken.add(tab.id);
        songs.push({ id: tab ? tab.id : 'n:' + e.notesFile.id, tab, notesFile: e.notesFile, notes, modified: (tab || e.notesFile).modifiedTime });
      });
      files.filter((x) => !isFolder(x) && SONG_EXT.test(x.name) && !tabTaken.has(x.id)).forEach((tab) => {
        songs.push({ id: tab.id, tab, notesFile: null, notes: null, modified: tab.modifiedTime });
      });
      // the song's own folder, when it is in one (inside Tabs)
      songs.forEach((sg) => {
        const pid = parentOf(sg.notesFile || sg.tab);
        sg.folder = files.find((x) => isFolder(x) && x.id === pid && tabsFolder && parentOf(x) === tabsFolder.id) || null;
        // when the song was added: the earliest of its folder, notes and tab (moving a file keeps its created time)
        const times = [sg.folder, sg.notesFile, sg.tab].filter(Boolean).map((x) => Date.parse(x.createdTime || x.modifiedTime)).filter((t) => t > 0);
        sg.addedAt = times.length ? Math.min(...times) : 0;
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

    const folderName = (notes) => slug(`${notes.title || 'Untitled'}${notes.artist ? ' - ' + notes.artist : ''}`);

    async function makeFolder(name, parentId) {
      const r = await call(`${API}/files?fields=id,name,mimeType,parents&supportsAllDrives=true`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: FOLDER_TYPE, parents: [parentId] })
      });
      const created = await r.json();
      (filesCache || (filesCache = [])).push(created);
      return created;
    }
    async function ensureTabsFolder() {
      if (!tabsFolder) await listFolder();
      if (!tabsFolder) tabsFolder = await makeFolder(TABS_NAME, folder().id);
      return tabsFolder;
    }
    async function createSongFolder(notes) {
      const tabs = await ensureTabsFolder();
      return makeFolder(folderName(notes), tabs.id);
    }
    async function moveInto(file, folderId) {
      await call(`${API}/files/${file.id}?addParents=${folderId}&removeParents=${parentOf(file) || folder().id}&supportsAllDrives=true&fields=id,parents`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      file.parents = [folderId];
    }
    // Moves songs saved straight in the band folder (before folders per song) into Tabs/<song>/.
    async function moveLooseSongs(songs) {
      let moved = 0;
      for (const sg of songs) {
        if (sg.folder) continue;
        try {
          const f = await createSongFolder(sg.notes || { title: sg.tab ? sg.tab.name.replace(SONG_EXT, '') : 'Untitled' });
          if (sg.tab) await moveInto(sg.tab, f.id);
          if (sg.notesFile) await moveInto(sg.notesFile, f.id);
          sg.folder = f;
          moved++;
        } catch (e) { /* no permission to move this one; it still works where it is */ }
      }
      return moved;
    }

    async function writeNotesFile(song, notes, nameIfNew, parentId) {
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
      const m = multipart({ name: nameIfNew + NOTES_SUFFIX, parents: [parentId], mimeType: 'application/json' }, json, 'application/json');
      const r = await call(`${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,modifiedTime,parents`, { method: 'POST', headers: { 'Content-Type': m.type }, body: m.body });
      const created = await r.json();
      (filesCache || (filesCache = [])).push(created);
      return created;
    }
    async function uploadTab(fileName, bytes, parentId) {
      const m = multipart({ name: fileName, parents: [parentId] }, bytes, 'application/octet-stream');
      const r = await call(`${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,modifiedTime,parents`, { method: 'POST', headers: { 'Content-Type': m.type }, body: m.body });
      const created = await r.json();
      (filesCache || (filesCache = [])).push(created);
      return created;
    }
    const downloadTab = async (fileId) => new Uint8Array(await (await call(`${API}/files/${fileId}?alt=media&supportsAllDrives=true`)).arrayBuffer());

    // Copies every song to this device, downloading a tab only when it is new or has changed since the last copy.
    let syncing = null;
    async function syncOffline(folderId, songs) {
      if (syncing) return syncing;
      syncing = (async () => {
        for (const sg of songs) {
          const k = `${folderId}:song:${sg.id}`;
          const saved = await offline.get(k).catch(() => null);
          let bytes = saved ? saved.bytes : null;
          if (sg.hasTab && (!saved || saved.tabVersion !== sg.tabVersion || !saved.bytes)) {
            const tab = (filesCache || []).find((x) => x.id === sg.id);
            if (!tab) continue;
            try { bytes = await downloadTab(tab.id); } catch (e) { continue; }
          }
          await offline.put({ k, bytes: sg.hasTab ? bytes : null, notes: sg.notes, title: sg.title, artist: sg.artist, fileName: sg.fileName, tabVersion: sg.tabVersion, savedAt: Date.now() }).catch(() => {});
        }
      })().finally(() => { syncing = null; });
      return syncing;
    }
    const offlineSync = () => syncing || Promise.resolve();

    /* ----- the song list: a Google Sheet anyone can open without Setcards ----- */
    const SHEET_NAME = 'Song list';
    const SHEET_TYPE = 'application/vnd.google-apps.spreadsheet';
    const STATUS = { proposed: 'Proposed', learning: 'Learning', ready: 'Ready' };
    let lastSheetCsv = null;
    let sheetTimer = 0;
    const summaries = new Map();   // song id -> the fields the sheet shows, to spot changes that matter

    function rowFor(s) {
      const n = s.notes || {};
      const m = n.meta || {};
      const status = STATUS[n.status] ? n.status : (s.tab ? 'learning' : 'proposed');
      const key = n.bandKey || n.key || (m.key ? `${m.key}${m.keyGuessed ? ' (estimated)' : ''}` : '');
      const seconds = m.seconds;
      return {
        title: n.title || (s.tab ? s.tab.name.replace(SONG_EXT, '') : 'Untitled'),
        artist: n.artist || '',
        status,
        cells: [
          n.title || (s.tab ? s.tab.name.replace(SONG_EXT, '') : 'Untitled'), n.artist || '', STATUS[status], key, n.originalKey || '',
          n.tempo || m.tempo || '', seconds ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : '',
          n.youtubeUrl || '', s.tab ? s.tab.name : ''
        ]
      };
    }
    const summaryOf = (s) => JSON.stringify(rowFor(s).cells);
    const csvCell = (v) => { const t = String(v ?? ''); return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    // Sheets may write CSV back with different line endings or quoting, so compare cell by cell.
    const sameTable = (a, b) => {
      const norm = (csv) => (csv || '').replace(/\r/g, '').replace(/"/g, '').trim();
      return norm(a) === norm(b);
    };

    // Reads CSV as Google exports it: quoted cells may hold commas, quotes ("") and line breaks.
    function parseCsv(text) {
      const rows = [];
      let row = [];
      let cell = '';
      let quoted = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
          if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
          if (ch === '\r' && text[i + 1] === '\n') i++;
          row.push(cell); rows.push(row); row = []; cell = '';
        } else cell += ch;
      }
      if (cell || row.length) { row.push(cell); rows.push(row); }
      return rows;
    }

    // The sheet's own order is the band's order: whoever rearranges the rows there decides how songs are listed.
    // Songs are found by their tab file, or by title and artist; songs not in the sheet go at the bottom, oldest first.
    function orderBySheet(songs, csv) {
      const rows = parseCsv(csv || '');
      const head = (rows.shift() || []).map((h) => h.trim().toLowerCase());
      const col = (name) => head.indexOf(name);
      const [ct, ca, cf] = [col('title'), col('artist'), col('tab file')];
      const norm = (v) => String(v || '').trim().toLowerCase();
      const used = new Set();
      const place = (s) => {
        const r = rowFor(s).cells;
        const find = (test) => rows.findIndex((row, i) => !used.has(i) && test(row));
        let i = s.tab && cf >= 0 ? find((row) => row[cf] && row[cf] === s.tab.name) : -1;
        if (i < 0 && ct >= 0) i = find((row) => norm(row[ct]) === norm(r[0]) && (ca < 0 || norm(row[ca]) === norm(r[1])));
        if (i >= 0) used.add(i);
        return i;
      };
      // songs with a tab are matched first, as their file name is the surest match
      const pos = new Map();
      songs.filter((s) => s.tab).forEach((s) => pos.set(s, place(s)));
      songs.filter((s) => !s.tab).forEach((s) => pos.set(s, place(s)));
      const rank = (s) => (pos.get(s) >= 0 ? pos.get(s) : Infinity);
      return songs.slice().sort((a, b) => rank(a) - rank(b) || (a.addedAt || 0) - (b.addedAt || 0));
    }
    async function readSheet() {
      const sheet = (filesCache || []).find((x) => x.name === SHEET_NAME && x.mimeType === SHEET_TYPE);
      if (!sheet) return null;
      lastSheetCsv = await (await call(`${API}/files/${sheet.id}/export?mimeType=text/csv`)).text();
      return lastSheetCsv;
    }

    // songs are written in the order given (the sheet's own order, with new songs at the bottom)
    function songListCsv(songs) {
      const rows = songs.map(rowFor);
      const head = ['Title', 'Artist', 'Status', 'Band key', 'Original key', 'Tempo (bpm)', 'Length', 'YouTube', 'Tab file'];
      return [head, ...rows.map((r) => r.cells)].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
    }

    // Writes the song list sheet if what it shows has changed. Creates it the first time.
    async function syncSongList() {
      clearTimeout(sheetTimer);
      filesCache = null;
      const songs = await allSongs();
      songs.forEach((s) => summaries.set(s.id, summaryOf(s)));
      const sheet = filesCache.find((x) => x.name === SHEET_NAME && x.mimeType === SHEET_TYPE);
      // read it fresh each time, so rows someone has just moved stay where they put them
      let current = '';
      if (sheet) { try { current = await readSheet(); } catch (e) { current = lastSheetCsv || ''; } }
      const csv = songListCsv(orderBySheet(songs, current));
      if (sameTable(csv, current)) return false;
      if (sheet) {
        await call(`${UPLOAD}/files/${sheet.id}?uploadType=media&supportsAllDrives=true`, { method: 'PATCH', headers: { 'Content-Type': 'text/csv' }, body: csv });
      } else {
        const m = multipart({ name: SHEET_NAME, parents: [folder().id], mimeType: SHEET_TYPE }, csv, 'text/csv');
        const r = await call(`${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType`, { method: 'POST', headers: { 'Content-Type': m.type }, body: m.body });
        filesCache.push(await r.json());
      }
      lastSheetCsv = csv;
      return true;
    }
    // Several changes in a row are written to the sheet together.
    function scheduleSongList() {
      clearTimeout(sheetTimer);
      sheetTimer = setTimeout(() => { syncSongList().catch(() => {}); }, 5000);
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
        lastSheetCsv = null;
        tabsFolder = null;
        summaries.clear();
        token = null;
        try { sessionStorage.removeItem('setcards:gtoken2'); } catch (e) { /* storage unavailable */ }
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
      // The band's songs. Online, the list and every song are also copied to this device in the background;
      // when Drive can't be reached, the copy is returned instead, marked offline.
      async list() {
        let songs;
        try {
          songs = await this.listOnline();
        } catch (e) {
          const saved = await this.listSaved();
          if (!saved) throw e;
          return saved;
        }
        const f = folder();
        await offline.put({ k: `${f.id}:list`, songs, savedAt: Date.now() }).catch(() => {});
        syncOffline(f.id, songs).catch(() => {});
        return songs;
      },
      // The copy of the list kept on this device, or null if there isn't one yet.
      async listSaved() {
        const f = folder();
        if (!f) return null;
        const saved = await offline.get(`${f.id}:list`).catch(() => null);
        if (!saved) return null;
        return saved.songs.map((sg) => ({ ...sg, offline: true, savedAt: saved.savedAt }));
      },
      async listOnline() {
        filesCache = null;
        let songs = await allSongs();
        if (songs.some((sg) => !sg.folder) && await moveLooseSongs(songs)) { filesCache = null; songs = await allSongs(); }
        songs.forEach((s) => summaries.set(s.id, summaryOf(s)));
        let csv = lastSheetCsv;
        try { csv = await readSheet(); } catch (e) { /* the last order read is used */ }
        songs = orderBySheet(songs, csv);
        scheduleSongList();   // brings the sheet up to date if a change was missed (it is only rewritten if different)
        return songs.map((s, order) => ({
          order,
          id: s.id,
          title: (s.notes && s.notes.title) || (s.tab ? s.tab.name.replace(SONG_EXT, '').replace(/[_-]+/g, ' ') : 'Untitled'),
          artist: (s.notes && s.notes.artist) || '',
          fileName: s.tab ? s.tab.name : null,
          hasTab: !!s.tab,
          tabVersion: s.tab ? s.tab.modifiedTime : null,
          updatedAt: Date.parse(s.modified) || 0,
          addedAt: s.addedAt,
          notes: s.notes
        }));
      },
      // Opens the copy saved on this device straight away when there is one; `latest()` then checks the band
      // folder and gives the song again only if something changed. Without a saved copy it is fetched first.
      async open(id) {
        const f = folder();
        const k = `${f.id}:song:${id}`;
        const saved = await offline.get(k).catch(() => null);
        const fetchLatest = async () => {
          const song = await findSong(id);
          const tabVersion = song.tab ? song.tab.modifiedTime : null;
          // the tab is only downloaded again when it has changed
          const bytes = !song.tab ? null : (saved && saved.bytes && saved.tabVersion === tabVersion ? saved.bytes : await downloadTab(song.tab.id));
          const notes = song.notes;
          const result = { bytes, notes, title: notes && notes.title, artist: notes && notes.artist, fileName: song.tab ? song.tab.name : null, tabVersion };
          offline.put({ k, ...result, savedAt: Date.now() }).catch(() => {});
          return result;
        };
        const fromSaved = (extra) => ({ bytes: saved.bytes, notes: saved.notes, title: saved.title, artist: saved.artist, fileName: saved.fileName, tabVersion: saved.tabVersion, savedAt: saved.savedAt, ...extra });
        if (saved && (saved.bytes || !saved.fileName)) {
          return fromSaved({
            latest: async () => {
              const fresh = await fetchLatest();
              const same = fresh.tabVersion === saved.tabVersion && JSON.stringify(fresh.notes || null) === JSON.stringify(saved.notes || null);
              return same ? null : fresh;
            }
          });
        }
        try {
          return await fetchLatest();
        } catch (e) {
          if (!saved) throw e;
          return fromSaved({ offline: true });
        }
      },
      async saveNotes(id, notes) {
        const song = await findSong(id);
        if (song.tab && !notes.tabFile) notes.tabFile = song.tab.name;
        if (!song.folder && !song.notesFile) await moveLooseSongs([song]);
        await writeNotesFile(song, notes, song.tab ? song.tab.name : folderName(notes), song.folder ? song.folder.id : folder().id);
        // keep the song's folder named after its title and artist
        if (song.folder && song.folder.name !== folderName(notes)) {
          try {
            await call(`${API}/files/${song.folder.id}?supportsAllDrives=true`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: folderName(notes) }) });
            song.folder.name = folderName(notes);
          } catch (e) { /* the old name still works */ }
        }
        if (summaryOf({ ...song, notes }) !== summaries.get(id)) scheduleSongList();
        // the copy on this device opens first next time, so it carries the change too
        const k = `${folder().id}:song:${id}`;
        const saved = await offline.get(k).catch(() => null);
        if (saved) await offline.put({ ...saved, notes }).catch(() => {});
      },
      // A song with tab (bytes) or without (bytes null: just the notes).
      async add(fileName, bytes, notes) {
        const songFolder = await createSongFolder(notes);
        if (!bytes) {
          const nf = await writeNotesFile(null, notes, folderName(notes), songFolder.id);
          scheduleSongList();
          return 'n:' + nf.id;
        }
        const tab = await uploadTab(fileName, bytes, songFolder.id);
        notes.tabFile = fileName;
        await writeNotesFile(null, notes, fileName, songFolder.id);
        scheduleSongList();
        return tab.id;
      },
      // Gives a tab-less song its Guitar Pro file. Returns the song's new id.
      // An MP3 for a band song goes in its folder, so everyone in the band can play it.
      async uploadAudio(id, fileName, bytes) {
        const song = await findSong(id);
        if (!song.folder) await moveLooseSongs([song]);
        const m = multipart({ name: fileName, parents: [song.folder ? song.folder.id : folder().id] }, bytes, 'audio/mpeg');
        const r = await call(`${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id`, { method: 'POST', headers: { 'Content-Type': m.type }, body: m.body });
        return (await r.json()).id;
      },
      downloadAudio: (fileId) => downloadTab(fileId),
      trashAudio: (fileId) => trash(fileId),
      async attachTab(id, fileName, bytes, notes) {
        const song = await findSong(id);
        if (!song.folder) await moveLooseSongs([song]);
        const tab = await uploadTab(fileName, bytes, song.folder ? song.folder.id : folder().id);
        notes.tabFile = fileName;
        await writeNotesFile(song, notes, fileName, song.folder ? song.folder.id : folder().id);
        scheduleSongList();
        return tab.id;
      },
      async remove(id) {
        const song = await findSong(id);
        if (song.folder) {
          await trash(song.folder.id);   // the folder and everything in it
        } else {
          if (song.tab) await trash(song.tab.id);
          if (song.notesFile) await trash(song.notesFile.id);
        }
        filesCache = null;
        scheduleSongList();
      },
      syncSongList,
      offlineSync,
      songListUrl() {
        const sheet = (filesCache || []).find((x) => x.name === SHEET_NAME && x.mimeType === SHEET_TYPE);
        return sheet ? `https://docs.google.com/spreadsheets/d/${sheet.id}` : null;
      },
      preload,
    };
  })();

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

  const library = {
    sources,
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
