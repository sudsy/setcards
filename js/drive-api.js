/* The Google Drive API that Setcards uses, for reading and writing the band folder. Every write to Drive goes through
   here, so the app and the tools (scripts/drive-tool.mjs) make the same calls, in the same way.

   It has no browser code: the caller gives it fetch and the access token. The app gives the token of the person
   signed in; a tool gives one it was handed. Each method returns the parsed result, and throws an Error with a
   `status` when Drive refuses the call.

   create({ fetch, token, onUnauthorized })
     token()                    the access token, or throws if there is none
     onUnauthorized()           called when Drive says the token has expired (401), so it can be forgotten
*/
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};

  const API = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  const FOLDER_TYPE = 'application/vnd.google-apps.folder';
  const DEFAULT_FIELDS = 'id,name,modifiedTime,parents';

  // A multipart body: the file's details as JSON, then its content. Used when a file is created.
  function multipartBody(meta, body, type) {
    const boundary = 'setcards' + Math.random().toString(36).slice(2);
    const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${type}\r\n\r\n`;
    const tail = `\r\n--${boundary}--`;
    return { body: new Blob([head, body, tail]), type: `multipart/related; boundary=${boundary}` };
  }

  function create(opts) {
    const { fetch: doFetch, token, onUnauthorized } = opts;

    // One request to Drive, with the access token. A refusal is an Error with the status Drive gave.
    async function request(url, init = {}) {
      const t = await token();
      const r = await doFetch(url, Object.assign({}, init, { headers: Object.assign({ Authorization: 'Bearer ' + t }, init.headers || {}) }));
      if (r.status === 401) {
        if (onUnauthorized) onUnauthorized();
        const e = new Error('Your Google sign-in expired. Open Songs and tap Show band songs to sign in again.');
        e.status = 401;
        throw e;
      }
      if (!r.ok) {
        const e = new Error(`Google Drive said ${r.status}: ${(await r.text()).slice(0, 160)}`);
        e.status = r.status;
        throw e;
      }
      return r;
    }
    const json = async (url, init) => (await request(url, init)).json();

    const api = {
      request,

      // Reads: a file's content as text or bytes, and the parsed JSON of a file.
      async getText(fileId) { return (await request(`${API}/files/${fileId}?alt=media&supportsAllDrives=true`)).text(); },
      async getBytes(fileId) { return new Uint8Array(await (await request(`${API}/files/${fileId}?alt=media&supportsAllDrives=true`)).arrayBuffer()); },
      async getJson(fileId) { return json(`${API}/files/${fileId}?alt=media&supportsAllDrives=true`); },

      // Creates a file with its content (a new notes file, tab, drum kit, MP3 or sheet). Returns the file's details.
      createFile(meta, body, type, fields = DEFAULT_FIELDS) {
        const m = multipartBody(meta, body, type);
        return json(`${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=${fields}`, { method: 'POST', headers: { 'Content-Type': m.type }, body: m.body });
      },

      // Replaces a file's content. keepRevisionForever keeps this version of a notes file for good.
      replaceMedia(fileId, body, type, { keepRevisionForever = false, fields = DEFAULT_FIELDS } = {}) {
        const keep = keepRevisionForever ? '&keepRevisionForever=true' : '';
        return json(`${UPLOAD}/files/${fileId}?uploadType=media&supportsAllDrives=true${keep}&fields=${fields}`, { method: 'PATCH', headers: { 'Content-Type': type }, body });
      },

      // Changes a file's details (its name, or whether it is in the trash), or moves it between folders.
      updateFile(fileId, changes, { addParents, removeParents, fields = 'id,name,parents' } = {}) {
        const q = [];
        if (addParents) q.push(`addParents=${addParents}`);
        if (removeParents) q.push(`removeParents=${removeParents}`);
        q.push('supportsAllDrives=true', `fields=${fields}`);
        return json(`${API}/files/${fileId}?${q.join('&')}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes || {}) });
      },

      // Makes a folder, inside parentId when one is given.
      createFolder(name, parentId, fields = 'id,name,mimeType,parents') {
        const body = { name, mimeType: FOLDER_TYPE };
        if (parentId) body.parents = [parentId];
        return json(`${API}/files?fields=${fields}&supportsAllDrives=true`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      },

      // Puts a file in the trash (it can be restored from Drive).
      trashFile(fileId) {
        return api.updateFile(fileId, { trashed: true }, { fields: 'id,trashed' });
      },
    };
    return api;
  }

  SM.driveApi = { create, multipartBody, API, UPLOAD, FOLDER_TYPE };
})(typeof window !== 'undefined' ? window : globalThis);
