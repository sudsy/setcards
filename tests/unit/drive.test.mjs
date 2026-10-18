// Runs the real Google Drive source against a simulated Drive folder, to check how songs with and
// without tab files are listed, added and given their tab later.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

// A pretend Drive folder: files by id, with contents, answering the few API calls the source makes.
function fakeDrive(files) {
  let next = 100;
  const store = new Map(files.map((f) => [f.id, { parents: ['folder'], ...f }]));
  const json = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), arrayBuffer: async () => new ArrayBuffer(0) });
  const add = (meta, content) => {
    const id = 'id' + next++;
    store.set(id, { id, name: meta.name, mimeType: meta.mimeType, parents: meta.parents || ['folder'], content, modifiedTime: new Date().toISOString() });
    return { id, name: meta.name, mimeType: meta.mimeType, parents: meta.parents };
  };
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url);
    const method = opts.method || 'GET';
    if (method === 'GET' && u.pathname.endsWith('/files') && u.searchParams.get('q')) {
      const ids = [...u.searchParams.get('q').matchAll(/'([^']+)' in parents/g)].map((m) => m[1]);
      return json({ files: [...store.values()].filter((f) => !f.trashed && f.parents.some((p) => ids.includes(p)))
        .map(({ id, name, mimeType, modifiedTime, parents }) => ({ id, name, mimeType, modifiedTime, parents })) });
    }
    const exportMatch = u.pathname.match(/\/files\/([^/]+)\/export$/);
    if (method === 'GET' && exportMatch) {
      const f = store.get(exportMatch[1]);
      return { ok: true, status: 200, text: async () => f.content.replace(/\r\n/g, '\n') };
    }
    const idMatch = u.pathname.match(/\/files\/([^/]+)$/);
    if (method === 'GET' && idMatch && u.searchParams.get('alt') === 'media') {
      const f = store.get(idMatch[1]);
      return { ok: true, status: 200, json: async () => JSON.parse(f.content), arrayBuffer: async () => new TextEncoder().encode(f.content || 'gp').buffer };
    }
    if (method === 'POST' && u.pathname.includes('/upload/')) {
      const text = await opts.body.text();
      const meta = JSON.parse(text.split('\r\n\r\n')[1].split('\r\n--')[0]);
      const content = text.split('\r\n\r\n')[2].split('\r\n--')[0];
      return json(add(meta, content));
    }
    if (method === 'POST' && u.pathname.endsWith('/files')) {
      return json(add(JSON.parse(opts.body)));
    }
    if (method === 'PATCH' && u.pathname.includes('/upload/') && idMatch) {
      store.get(idMatch[1]).content = opts.body;
      (store.get(idMatch[1]).saves = store.get(idMatch[1]).saves || []).push({ keepForever: u.searchParams.get('keepRevisionForever') === 'true' });
      return json({ id: idMatch[1] });
    }
    if (method === 'PATCH' && idMatch) {
      const f = store.get(idMatch[1]);
      const addTo = u.searchParams.get('addParents');
      if (addTo) f.parents = [...f.parents.filter((p) => p !== u.searchParams.get('removeParents')), addTo];
      Object.assign(f, JSON.parse(opts.body));
      if (f.trashed) [...store.values()].filter((c) => c.parents.includes(f.id)).forEach((c) => { c.trashed = true; });
      return json({ id: idMatch[1] });
    }
    throw new Error(`unexpected ${method} ${url}`);
  };
  return store;
}

// The folder path of a file, e.g. "Tabs/Smooth Operator - Sade/smooth.gp".
const pathOf = (store, f) => {
  const parts = [f.name];
  let p = f.parents[0];
  while (p && p !== 'folder') { const parent = store.get(p); parts.unshift(parent.name); p = parent.parents[0]; }
  return parts.join('/');
};
const paths = (store) => [...store.values()].filter((f) => !f.trashed && f.mimeType !== 'application/vnd.google-apps.folder').map((f) => pathOf(store, f)).sort();

function loadDrive() {
  globalThis.window = globalThis;
  globalThis.localStorage = memoryStorage({ 'setcards:driveFolder': JSON.stringify({ id: 'folder', name: 'Band' }) });
  globalThis.sessionStorage = memoryStorage({ 'setcards:gtoken': JSON.stringify({ token: 't', exp: Date.now() + 3600e3 }) });
  globalThis.SETCARDS_CONFIG = { google: { clientId: 'x' } };
  delete require.cache[require.resolve('../../js/storage.js')];
  delete globalThis.SM;
  require('../../js/storage.js');
  return globalThis.SM.library.sources.drive;
}

const notes = (o) => JSON.stringify({ format: 'setcards/1', ...o });

test('lists songs with tab, songs without tab, and tab files without notes', async () => {
  fakeDrive([
    { id: 'a', name: 'smooth.gp', content: 'gp' },
    { id: 'an', name: 'smooth.gp.setcards.json', content: notes({ title: 'Smooth Operator', artist: 'Sade' }) },
    { id: 'idea', name: 'Idea - Band.setcards.json', content: notes({ title: 'Idea', artist: 'Band', status: 'proposed' }) },
    { id: 'b', name: 'landslide.gp', content: 'gp' }
  ]);
  const drive = loadDrive();
  const songs = (await drive.list()).sort((x, y) => x.title.localeCompare(y.title));
  assert.deepEqual(songs.map((s) => [s.id, s.title, s.hasTab]), [
    ['n:idea', 'Idea', false],
    ['b', 'landslide', true],
    ['a', 'Smooth Operator', true]
  ]);
});

test('a song without tab is saved as notes only, and gets its tab later as one song', async () => {
  const store = fakeDrive([]);
  const drive = loadDrive();
  const id = await drive.add(null, null, { title: 'New Idea', artist: 'Us', status: 'proposed' });
  assert.match(id, /^n:/);
  assert.deepEqual(paths(store), ['Tabs/New Idea - Us/New Idea - Us.setcards.json']);

  const opened = await drive.open(id);
  assert.equal(opened.bytes, null);
  assert.equal(opened.notes.status, 'proposed');

  const tabId = await drive.attachTab(id, 'new-idea.gp', new Uint8Array([1, 2, 3]), { ...opened.notes, status: 'learning' });
  const songs = await drive.list();
  assert.equal(songs.length, 1, 'still one song');
  assert.equal(songs[0].id, tabId);
  assert.equal(songs[0].hasTab, true);
  assert.equal(songs[0].title, 'New Idea');
  assert.equal(songs[0].notes.tabFile, 'new-idea.gp');
  assert.equal(songs[0].notes.status, 'learning');
});

test('saving notes for a tab file without notes creates them next to it', async () => {
  const store = fakeDrive([{ id: 'b', name: 'landslide.gp', content: 'gp' }]);
  const drive = loadDrive();
  await drive.saveNotes('b', { title: 'Landslide', status: 'ready' });
  const n = [...store.values()].find((f) => f.name === 'landslide.gp.setcards.json');
  assert.ok(n, 'notes file created');
  assert.equal(pathOf(store, n), 'Tabs/Landslide/landslide.gp.setcards.json');
  assert.equal(JSON.parse(n.content).tabFile, 'landslide.gp');
  const songs = await drive.list();
  assert.equal(songs.length, 1);
  assert.equal(songs[0].title, 'Landslide');
});

test('removing a song moves its tab and notes to the bin', async () => {
  const store = fakeDrive([
    { id: 'a', name: 'smooth.gp', content: 'gp' },
    { id: 'an', name: 'smooth.gp.setcards.json', content: notes({ title: 'Smooth Operator' }) }
  ]);
  const drive = loadDrive();
  await drive.remove('a');
  assert.equal(store.get('a').trashed, true);
  assert.equal(store.get('an').trashed, true);
  assert.equal((await drive.list()).length, 0);
});

test('the first save of the day is kept as a permanent version, later saves are not', async () => {
  const store = fakeDrive([
    { id: 'a', name: 'smooth.gp', content: 'gp' },
    { id: 'an', name: 'smooth.gp.setcards.json', content: notes({ title: 'Smooth Operator' }) }
  ]);
  const drive = loadDrive();
  await drive.saveNotes('a', { title: 'Smooth Operator', status: 'learning' });
  await drive.saveNotes('a', { title: 'Smooth Operator', status: 'ready' });
  assert.deepEqual(store.get('an').saves, [{ keepForever: true }, { keepForever: false }]);
  assert.equal(JSON.parse(store.get('an').content).status, 'ready');
});

test('a Song list sheet is kept in the folder, and only rewritten when what it shows changes', async () => {
  const store = fakeDrive([
    { id: 'a', name: 'smooth.gp', content: 'gp' },
    { id: 'an', name: 'smooth.gp.setcards.json', content: notes({ title: 'Smooth Operator', artist: 'Sade', status: 'ready', meta: { key: 'Dm', keyGuessed: true, tempo: 120, seconds: 254 } }) }
  ]);
  let drive = loadDrive();
  await drive.add(null, null, { title: 'New, Idea', artist: 'Us', status: 'proposed', youtubeUrl: 'https://youtu.be/x' });
  assert.equal(await drive.syncSongList(), true);
  const sheet = [...store.values()].find((f) => f.name === 'Song list');
  assert.equal(sheet.mimeType, 'application/vnd.google-apps.spreadsheet');
  assert.deepEqual(sheet.content.trim().split('\r\n'), [
    'Title,Artist,Status,Band key,Original key,Tempo (bpm),Length,YouTube,Tab file',
    'Smooth Operator,Sade,Ready,Dm (estimated),,120,4m 14s,,smooth.gp',
    '"New, Idea",Us,Proposed,,,,,https://youtu.be/x,'
  ]);

  // a fresh start with nothing changed reads the sheet and leaves it alone
  drive = loadDrive();
  assert.equal(await drive.syncSongList(), false);

  // a chord change doesn't touch the sheet; a status change does
  await drive.list();
  await drive.saveNotes('a', { title: 'Smooth Operator', artist: 'Sade', status: 'ready', meta: { key: 'Dm', keyGuessed: true, tempo: 120, seconds: 254 }, chords: { 3: 'Am' } });
  assert.equal(await drive.syncSongList(), false);
  await drive.saveNotes('a', { title: 'Smooth Operator', artist: 'Sade', status: 'learning', meta: { key: 'Dm', keyGuessed: true, tempo: 120, seconds: 254 } });
  assert.equal(await drive.syncSongList(), true);
  assert.match(sheet.content, /Smooth Operator,Sade,Learning/);
});

test('songs saved straight in the band folder are moved into Tabs, one folder per song', async () => {
  const store = fakeDrive([
    { id: 'a', name: 'smooth.gp', content: 'gp' },
    { id: 'an', name: 'smooth.gp.setcards.json', content: notes({ title: 'Smooth Operator', artist: 'Sade' }) },
    { id: 'idea', name: 'Idea - Band.setcards.json', content: notes({ title: 'Idea', artist: 'Band' }) },
    { id: 'b', name: 'landslide.gp', content: 'gp' }
  ]);
  const drive = loadDrive();
  const songs = await drive.list();
  assert.equal(songs.length, 3);
  assert.deepEqual(paths(store), [
    'Tabs/Idea - Band/Idea - Band.setcards.json',
    'Tabs/Smooth Operator - Sade/smooth.gp',
    'Tabs/Smooth Operator - Sade/smooth.gp.setcards.json',
    'Tabs/landslide/landslide.gp'
  ]);
  // ids are kept, so songs open as before
  assert.deepEqual(songs.map((x) => x.id).sort(), ['a', 'b', 'n:idea']);
});

test('a new song gets its own folder, renamed when its title changes, and removed with it', async () => {
  const store = fakeDrive([]);
  const drive = loadDrive();
  const id = await drive.add('easy.gp', new Uint8Array([1]), { title: 'Easy', artist: 'Commodores' });
  assert.deepEqual(paths(store), ['Tabs/Easy - Commodores/easy.gp', 'Tabs/Easy - Commodores/easy.gp.setcards.json']);
  await drive.saveNotes(id, { title: 'Easy (live)', artist: 'Commodores' });
  assert.deepEqual(paths(store), ['Tabs/Easy (live) - Commodores/easy.gp', 'Tabs/Easy (live) - Commodores/easy.gp.setcards.json']);
  await drive.remove(id);
  assert.deepEqual(paths(store), []);
});

test('every song is copied to the device in the background, and opens from there when Drive is out of reach', async () => {
  const store = fakeDrive([
    { id: 'a', name: 'smooth.gp', content: 'smooth tab' },
    { id: 'an', name: 'smooth.gp.setcards.json', content: notes({ title: 'Smooth Operator', artist: 'Sade' }) },
    { id: 'b', name: 'landslide.gp', content: 'landslide tab' }
  ]);
  const drive = loadDrive();
  const online = await drive.list();
  await drive.offlineSync();
  assert.equal(online.some((s) => s.offline), false);

  // the connection drops
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  const saved = await drive.list();
  assert.deepEqual(saved.map((s) => s.title).sort(), ['Smooth Operator', 'landslide']);
  assert.ok(saved.every((s) => s.offline));
  // a song never opened online still opens, tab included
  const song = await drive.open('b');
  assert.equal(song.offline, true);
  assert.equal(new TextDecoder().decode(song.bytes), 'landslide tab');

  // back online: only a changed tab is downloaded again
  globalThis.fetch = realFetch;
  const downloads = [];
  const counting = globalThis.fetch;
  globalThis.fetch = (url, opts) => { if (String(url).includes('alt=media') && /files\/(a|b)\?/.test(String(url))) downloads.push(String(url).match(/files\/(\w+)\?/)[1]); return counting(url, opts); };
  store.get('b').modifiedTime = new Date(Date.now() + 1000).toISOString();
  await drive.list();
  await drive.offlineSync();
  assert.deepEqual(downloads, ['b']);
});

test('with nothing saved yet, an unreachable Drive still reports the problem', async () => {
  fakeDrive([]);
  const drive = loadDrive();
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(() => drive.list(), /Failed to fetch/);
});
