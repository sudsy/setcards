#!/usr/bin/env node
// The band folder tool: the same Google Drive API the app uses (js/drive-api.js), for an agent or a person at a terminal.
// It needs an access token for the band's Google account in SETCARDS_DRIVE_TOKEN (the app's own sign-in is not used here).
// Notes are checked with js/notes.js before they are written.
//
//   node scripts/drive-tool.mjs list       FOLDER_ID
//   node scripts/drive-tool.mjs notes-get  FILE_ID
//   node scripts/drive-tool.mjs notes-put  FILE_ID  LOCAL.json
//   node scripts/drive-tool.mjs notes-new  FOLDER_ID "Name.gp.setcards.json" LOCAL.json
//   node scripts/drive-tool.mjs rename     FILE_ID  "New name"
//   node scripts/drive-tool.mjs trash      FILE_ID
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
globalThis.window = undefined;
require(join(here, '..', 'js', 'notes.js'));
require(join(here, '..', 'js', 'drive-api.js'));
const { SM } = globalThis;

const token = process.env.SETCARDS_DRIVE_TOKEN;
const [cmd, ...args] = process.argv.slice(2);
function fail(msg, code = 1) { console.error(msg); process.exit(code); }
if (!token) fail('Set SETCARDS_DRIVE_TOKEN to an access token for the band folder.');
const api = SM.driveApi.create({ fetch: (...a) => fetch(...a), token: () => token });
const { API } = SM.driveApi;

// Notes that are not valid are not sent to Drive.
function checkedNotes(path) {
  let notes;
  try { notes = JSON.parse(readFileSync(path, 'utf8')); } catch (e) { fail(`not JSON: ${e.message}`); }
  const errors = SM.notes.validate(notes);
  if (errors.length) { errors.forEach((e) => console.error(`  - ${e}`)); fail('Not sent, the notes would be invalid.', 2); }
  return JSON.stringify(notes, null, 1);
}

try {
  switch (cmd) {
    case 'list': {
      const q = encodeURIComponent(`'${args[0]}' in parents and trashed = false`);
      const r = await api.request(`${API}/files?q=${q}&fields=files(id,name,mimeType,modifiedTime)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`);
      for (const f of (await r.json()).files || []) console.log(`${f.id}\t${f.mimeType === SM.driveApi.FOLDER_TYPE ? 'folder' : 'file'}\t${f.name}`);
      break;
    }
    case 'notes-get': console.log(await api.getText(args[0])); break;
    case 'notes-put': {
      const r = await api.replaceMedia(args[0], checkedNotes(args[1]), 'application/json', { fields: 'id,name,modifiedTime' });
      console.log(`saved ${r.name} (${r.modifiedTime})`);
      break;
    }
    case 'notes-new': {
      const r = await api.createFile({ name: args[1], parents: [args[0]], mimeType: 'application/json' }, checkedNotes(args[2]), 'application/json', 'id,name');
      console.log(`created ${r.name} (${r.id})`);
      break;
    }
    case 'rename': {
      const r = await api.updateFile(args[0], { name: args[1] }, { fields: 'id,name' });
      console.log(`renamed to ${r.name}`);
      break;
    }
    case 'trash': await api.trashFile(args[0]); console.log('moved to the trash'); break;
    default: fail('usage: drive-tool.mjs list|notes-get|notes-put|notes-new|rename|trash ...');
  }
} catch (e) {
  fail(e.message, e.status === 401 ? 3 : 1);
}
