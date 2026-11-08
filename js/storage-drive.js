/* The Google Drive source: a band's folder of songs, notes and drum kits. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};
  const { ls, NOTES_SUFFIX, SONG_EXT } = SM.storeCore;
  const { offline } = SM.storeDevice;

  /* ---------------- Google Drive ---------------- */
  // Each person signs in with their own Google account and picks the band's shared folder.
  // Songs and notes live in that folder; nothing is stored on any server of ours.
  // Uses the full Drive permission, so the band folder and everything in it is visible,
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

    // Calls made without a tap (opening a song, checking for the band's latest changes) never open Google's sign-in
    // window: a browser blocks a popup that no tap caused, and it would be shown on every song. They use the access
    // from a sign-in the person made. Without one they fail, and the saved copy stays on screen, read only.
    // Every call to Drive goes through the shared Drive API (js/drive-api.js): reads and writes alike.
    const api = SM.driveApi.create({
      fetch: (...a) => fetch(...a),
      token: () => { if (!hasToken()) throw new Error('Google needs you to sign in again. Open Songs and tap Show band songs.'); return token; },
      onUnauthorized: () => { token = null; try { sessionStorage.removeItem('setcards:gtoken2'); } catch (e) { /* storage unavailable */ } },
    });
    const call = (url, opts) => api.request(url, opts);

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
    const SETLISTS_NAME = 'Set lists';
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

    const multipart = SM.driveApi.multipartBody;

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
      const created = await api.createFolder(name, parentId);
      (filesCache || (filesCache = [])).push(created);
      return created;
    }
    // The "Set lists" folder in the band folder; made only when asked for.
    async function setlistsFolder(create) {
      const f = folder();
      if (!f) return null;
      const found = (await childrenOf([f.id])).find((x) => x.mimeType === FOLDER_TYPE && x.name === SETLISTS_NAME);
      if (found || !create) return found || null;
      return makeFolder(SETLISTS_NAME, f.id);
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
      await api.updateFile(file.id, {}, { addParents: folderId, removeParents: parentOf(file) || folder().id, fields: 'id,parents' });
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
        await api.replaceMedia(song.notesFile.id, json, 'application/json', { keepRevisionForever: keep, fields: 'id' });
        if (keep) ls.set(keptKey, today);
        return song.notesFile;
      }
      const created = await api.createFile({ name: nameIfNew + NOTES_SUFFIX, parents: [parentId], mimeType: 'application/json' }, json, 'application/json');
      (filesCache || (filesCache = [])).push(created);
      return created;
    }
    async function uploadTab(fileName, bytes, parentId) {
      const created = await api.createFile({ name: fileName, parents: [parentId] }, bytes, 'application/octet-stream');
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

    const SHEET_HEAD = ['Title', 'Artist', 'Status', 'Band key', 'Original key', 'Tempo (bpm)', 'Length', 'YouTube', 'Tab file'];
    const sheetLine = (cells) => cells.map(csvCell).join(',');
    const sameCells = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);

    // The sheet is only changed for one song at a time, when it is added, removed or its details change.
    // That song's row is replaced where it is, a new song goes at the bottom, and a removed song's row is taken out.
    // No other row moves, so the order the band chose stays as it is.
    const pendingRows = new Map();   // song -> { song, removed, before } for changes not yet written
    let sheetQueue = Promise.resolve();
    const rowKey = (song) => `${rowFor(song).cells[0]}|${song.tab ? song.tab.name : ''}`;

    // Finds the row of a song: by its tab file, or else by its title and artist as they were before any change.
    function rowIndex(rows, head, song, before) {
      const norm = (v) => String(v || '').trim().toLowerCase();
      const [ct, ca, cf] = [head.indexOf('title'), head.indexOf('artist'), head.indexOf('tab file')];
      const find = (test) => rows.findIndex(test);
      let i = song.tab && cf >= 0 ? find((row) => row[cf] === song.tab.name) : -1;
      const titles = [before, rowFor(song).cells].filter(Boolean);
      for (const t of titles) {
        if (i >= 0 || ct < 0) break;
        i = find((row) => norm(row[ct]) === norm(t[0]) && (ca < 0 || norm(row[ca]) === norm(t[1])));
      }
      return i;
    }

    async function writeSongRow(song, change) {
      filesCache = null;
      const songs = await allSongs();   // also lists the band folder, which holds the sheet
      const sheet = filesCache.find((x) => x.name === SHEET_NAME && x.mimeType === SHEET_TYPE);
      const cells = rowFor(song).cells;
      if (!sheet) {
        if (change.removed) return false;
        // the first time, the sheet is made with every song in the order they were added
        const csv = [SHEET_HEAD, ...orderBySheet(songs, '').map((x) => rowFor(x).cells)].map(sheetLine).join('\r\n') + '\r\n';
        filesCache.push(await api.createFile({ name: SHEET_NAME, parents: [folder().id], mimeType: SHEET_TYPE }, csv, 'text/csv', 'id,name,mimeType'));
        lastSheetCsv = csv;
        return true;
      }
      const current = await readSheet();
      const rows = parseCsv(current);
      const head = (rows.shift() || []).map((h) => h.trim().toLowerCase());
      const i = rowIndex(rows, head, song, change.before);
      if (change.removed) {
        if (i < 0) return false;
        rows.splice(i, 1);
      } else if (i >= 0) {
        if (sameCells(rows[i], cells)) return false;
        rows[i] = cells;
      } else {
        rows.push(cells);
      }
      const csv = [SHEET_HEAD, ...rows].map(sheetLine).join('\r\n') + '\r\n';
      if (sameTable(csv, current)) return false;
      await api.replaceMedia(sheet.id, csv, 'text/csv', { fields: 'id' });
      lastSheetCsv = csv;
      return true;
    }

    // Writes the queued changes to the sheet, one after another so that two changes never overwrite each other.
    function flushSongRows() {
      const changes = [...pendingRows.values()];
      pendingRows.clear();
      sheetQueue = sheetQueue.then(async () => {
        for (const c of changes) {
          try { await writeSongRow(c.song, c); } catch (e) { console.error('The song list could not be updated', e); }
        }
      });
      return sheetQueue;
    }
    // Several changes in a row are written to the sheet together.
    function changeSongRow(song, change = {}) {
      pendingRows.set(rowKey(song), { song, removed: !!change.removed, before: change.before || null });
      clearTimeout(sheetTimer);
      sheetTimer = setTimeout(flushSongRows, 5000);
    }

    const trash = (id) => api.trashFile(id);

    return {
      id: 'drive',
      label: 'Band folder (Google Drive)',
      canWrite: true,
      configured: () => !!cfg().clientId,
      connected: () => !!folder(),
      signedIn: hasToken,
      // signed in on this device before (the access token itself is only kept for this session)
      wasSignedIn: () => !!ls.get('setcards:driveSignedIn'),
      // interactive: may open Google's sign-in; otherwise Google is asked to renew access without showing anything
      signIn: (interactive = true) => signIn(interactive),
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
        const f = await api.createFolder(name, undefined, 'id,name');
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
            await api.updateFile(song.folder.id, { name: folderName(notes) }, { fields: 'id,name' });
            song.folder.name = folderName(notes);
          } catch (e) { /* the old name still works */ }
        }
        if (summaryOf({ ...song, notes }) !== summaries.get(id)) changeSongRow({ ...song, notes }, { before: summaries.has(id) ? JSON.parse(summaries.get(id)) : null });
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
          changeSongRow({ notes, tab: null });
          return 'n:' + nf.id;
        }
        const tab = await uploadTab(fileName, bytes, songFolder.id);
        notes.tabFile = fileName;
        await writeNotesFile(null, notes, fileName, songFolder.id);
        changeSongRow({ notes, tab: { name: fileName } });
        return tab.id;
      },
      // Gives a tab-less song its Guitar Pro file. Returns the song's new id.
      // Puts a changed Guitar Pro file in place of the song's file, for notes edited in the tab.
      async replaceTab(id, bytes, fileName) {
        const song = await findSong(id);
        if (!song.tab) throw new Error('This song has no tab file');
        let updated = await api.replaceMedia(song.tab.id, bytes, 'application/octet-stream', { fields: 'id,name,modifiedTime' });
        if (fileName && fileName !== updated.name) {
          updated = await api.updateFile(song.tab.id, { name: fileName }, { fields: 'id,name,modifiedTime' });
        }
        song.tab.modifiedTime = updated.modifiedTime;
        changeSongRow({ ...song, tab: { name: fileName || song.tab.name } });
        return updated;
      },
      // Drum kits are .sf2 files in the band folder, so everyone in the band can choose from them.
      // Set lists: one JSON file each, in a "Set lists" folder in the band folder (made when the first is saved).
      setlists: {
        async list() {
          if (!folder()) return [];
          const dir = await setlistsFolder(false);
          if (!dir) return [];
          const files = (await childrenOf([dir.id])).filter((x) => x.mimeType !== FOLDER_TYPE && x.name.endsWith(SM.setlists.SUFFIX));
          const out = [];
          for (const x of files) {
            // a file that is not a set list is left out, and the others still show
            try { const list = SM.setlists.parse(await api.getText(x.id)); if (list) out.push({ id: x.id, list }); } catch (e) { /* skipped */ }
          }
          return out;
        },
        async write(id, list) {
          const body = SM.setlists.serialise(list);
          const name = SM.setlists.fileNameFor(list.name);
          if (id) {
            await api.replaceMedia(id, body, 'application/json', { fields: 'id' });
            await api.updateFile(id, { name }, { fields: 'id' });
            return id;
          }
          const dir = await setlistsFolder(true);
          return (await api.createFile({ name, parents: [dir.id], mimeType: 'application/json' }, body, 'application/json', 'id')).id;
        },
        remove: (id) => trash(id)
      },
      async listDrumKits() {
        const f = folder();
        if (!f) return [];
        const kids = await childrenOf([f.id]);
        return kids.filter((x) => x.mimeType !== FOLDER_TYPE && /\.sf2$/i.test(x.name)).map((x) => ({ name: x.name.replace(/\.sf2$/i, ''), fileId: x.id }));
      },
      async uploadDrumKit(name, bytes) {
        return (await api.createFile({ name: `${name}.sf2`, parents: [folder().id] }, bytes, 'application/octet-stream', 'id')).id;
      },
      downloadDrumKit: (fileId) => downloadTab(fileId),
      // An MP3 for a band song goes in its folder, so everyone in the band can play it.
      async uploadAudio(id, fileName, bytes) {
        const song = await findSong(id);
        if (!song.folder) await moveLooseSongs([song]);
        return (await api.createFile({ name: fileName, parents: [song.folder ? song.folder.id : folder().id] }, bytes, 'audio/mpeg', 'id')).id;
      },
      downloadAudio: (fileId) => downloadTab(fileId),
      trashAudio: (fileId) => trash(fileId),
      async attachTab(id, fileName, bytes, notes) {
        const song = await findSong(id);
        if (!song.folder) await moveLooseSongs([song]);
        const tab = await uploadTab(fileName, bytes, song.folder ? song.folder.id : folder().id);
        notes.tabFile = fileName;
        await writeNotesFile(song, notes, fileName, song.folder ? song.folder.id : folder().id);
        changeSongRow({ ...song, notes, tab: { name: fileName } });
        return tab.id;
      },
      async remove(id) {
        const song = await findSong(id);
        changeSongRow(song, { removed: true });
        if (song.folder) {
          await trash(song.folder.id);   // the folder and everything in it
        } else {
          if (song.tab) await trash(song.tab.id);
          if (song.notesFile) await trash(song.notesFile.id);
        }
        filesCache = null;
      },
      syncSongList: flushSongRows,
      offlineSync,
      songListUrl() {
        const sheet = (filesCache || []).find((x) => x.name === SHEET_NAME && x.mimeType === SHEET_TYPE);
        return sheet ? `https://docs.google.com/spreadsheets/d/${sheet.id}` : null;
      },
      preload,
    };
  })();


  SM.storeDrive = { drive };
})(typeof window !== 'undefined' ? window : globalThis);
