import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
globalThis.window = undefined;
require('../../js/drive-api.js');
const { create, API, UPLOAD, FOLDER_TYPE } = globalThis.SM.driveApi;

// A fake Drive: records each call, and answers with the given status and body.
function fakeDrive(answer = () => ({ status: 200, body: {} })) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body });
    const a = answer(String(url), init);
    return {
      ok: a.status >= 200 && a.status < 300, status: a.status,
      json: async () => a.body, text: async () => JSON.stringify(a.body),
      arrayBuffer: async () => new TextEncoder().encode(String(a.body)).buffer,
    };
  };
  const onUnauthorized = [];
  const api = create({ fetch, token: () => 'T0K', onUnauthorized: () => onUnauthorized.push(1) });
  return { api, calls, onUnauthorized };
}

test('every call carries the access token', async () => {
  const { api, calls } = fakeDrive();
  await api.request(`${API}/about`);
  assert.equal(calls[0].headers.Authorization, 'Bearer T0K');
});

test('a file is created with its details and content in one request', async () => {
  const { api, calls } = fakeDrive(() => ({ status: 200, body: { id: 'f1', name: 'Low Road.gp.setcards.json' } }));
  const created = await api.createFile({ name: 'Low Road.gp.setcards.json', parents: ['folder'] }, '{"a":1}', 'application/json');
  assert.equal(created.id, 'f1');
  assert.equal(calls[0].method, 'POST');
  assert.ok(calls[0].url.startsWith(`${UPLOAD}/files?uploadType=multipart`));
  assert.match(calls[0].headers['Content-Type'], /^multipart\/related; boundary=/);
});

test('a file\'s content is replaced, and a notes version can be kept for good', async () => {
  const { api, calls } = fakeDrive();
  await api.replaceMedia('f1', '{}', 'application/json', { keepRevisionForever: true });
  assert.equal(calls[0].method, 'PATCH');
  assert.ok(calls[0].url.includes('uploadType=media'));
  assert.ok(calls[0].url.includes('keepRevisionForever=true'));
  await api.replaceMedia('f1', '{}', 'application/json');
  assert.ok(!calls[1].url.includes('keepRevisionForever'));
});

test('a folder is moved, renamed and trashed through the same call', async () => {
  const { api, calls } = fakeDrive();
  await api.updateFile('f1', {}, { addParents: 'new', removeParents: 'old', fields: 'id,parents' });
  assert.ok(calls[0].url.includes('addParents=new') && calls[0].url.includes('removeParents=old'));
  await api.updateFile('f1', { name: 'Renamed' });
  assert.equal(JSON.parse(calls[1].body).name, 'Renamed');
  await api.trashFile('f1');
  assert.equal(JSON.parse(calls[2].body).trashed, true);
});

test('a folder is made inside a folder, or at the top', async () => {
  const { api, calls } = fakeDrive(() => ({ status: 200, body: { id: 'd1' } }));
  await api.createFolder('Tabs', 'band');
  assert.equal(JSON.parse(calls[0].body).mimeType, FOLDER_TYPE);
  assert.deepEqual(JSON.parse(calls[0].body).parents, ['band']);
  await api.createFolder('Top');
  assert.equal(JSON.parse(calls[1].body).parents, undefined);
});

test('a refusal is an error with the status, and an expired sign-in is forgotten', async () => {
  const { api, onUnauthorized } = fakeDrive(() => ({ status: 401, body: {} }));
  await assert.rejects(api.getText('f1'), (e) => e.status === 401 && /expired/.test(e.message));
  assert.equal(onUnauthorized.length, 1);
  const other = fakeDrive(() => ({ status: 403, body: { error: 'no' } }));
  await assert.rejects(other.api.getText('f1'), (e) => e.status === 403);
});
