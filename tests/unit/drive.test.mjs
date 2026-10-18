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
  const store = new Map(files.map((f) => [f.id, { ...f }]));
  const json = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body), arrayBuffer: async () => new ArrayBuffer(0) });
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url);
    const method = opts.method || 'GET';
    if (method === 'GET' && u.pathname.endsWith('/files') && u.searchParams.get('q')) {
      return json({ files: [...store.values()].filter((f) => !f.trashed).map(({ id, name, modifiedTime }) => ({ id, name, modifiedTime })) });
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
      const id = 'id' + next++;
      store.set(id, { id, name: meta.name, content, modifiedTime: new Date().toISOString() });
      return json({ id, name: meta.name });
    }
    if (method === 'PATCH' && u.pathname.includes('/upload/') && idMatch) {
      store.get(idMatch[1]).content = opts.body;
      (store.get(idMatch[1]).saves = store.get(idMatch[1]).saves || []).push({ keepForever: u.searchParams.get('keepRevisionForever') === 'true' });
      return json({ id: idMatch[1] });
    }
    if (method === 'PATCH' && idMatch) {
      Object.assign(store.get(idMatch[1]), JSON.parse(opts.body));
      return json({ id: idMatch[1] });
    }
    throw new Error(`unexpected ${method} ${url}`);
  };
  return store;
}

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
  assert.deepEqual([...store.values()].map((f) => f.name), ['New Idea - Us.setcards.json']);

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
