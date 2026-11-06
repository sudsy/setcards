#!/usr/bin/env node
// The notes tool: reads and edits a song's notes file (the .setcards.json kept in the band folder next to the song).
// The app and agents use the same checks (js/notes.js). Bar numbers here count from 1, as the app shows them.
//
//   node scripts/notes-tool.mjs show     FILE
//   node scripts/notes-tool.mjs validate FILE
//   node scripts/notes-tool.mjs new      FILE "Title" "Artist"
//   node scripts/notes-tool.mjs chord    FILE BAR "Dm7 G7"      (empty text clears; "-" means no chord)
//   node scripts/notes-tool.mjs section  FILE BAR "Chorus"       (adds or renames the section starting at BAR)
//   node scripts/notes-tool.mjs unsection FILE BAR               (removes the section starting at BAR)
//
// A change is written only if the notes are still valid afterwards. The file is written as JSON with two spaces.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
globalThis.window = undefined;
require(join(dirname(fileURLToPath(import.meta.url)), '..', 'js', 'notes.js'));
const N = globalThis.SM.notes;

const [cmd, file, ...args] = process.argv.slice(2);
const usage = 'usage: notes-tool.mjs show|validate|new|chord|section|unsection FILE ...';

function fail(msg) { console.error(msg); process.exit(1); }
function load() {
  if (!file) fail(usage);
  if (!existsSync(file)) fail(`no such file: ${file}`);
  let notes;
  try { notes = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { fail(`not JSON: ${e.message}`); }
  return notes;
}
function save(notes) {
  const errors = N.validate(notes);
  if (errors.length) { console.error('Not written, the notes would be invalid:'); errors.forEach((e) => console.error(`  - ${e}`)); process.exit(2); }
  notes.updatedAt = Date.now();
  writeFileSync(file, JSON.stringify(notes, null, 2) + '\n');
  console.log(`saved ${file}`);
}
const bar0 = (text) => {
  const n = Number(text);
  if (!Number.isInteger(n) || n < 1) fail(`bar must be a bar number from 1, got "${text}"`);
  return n - 1;
};

switch (cmd) {
  case 'show': console.log(N.describe(load())); break;
  case 'validate': {
    const errors = N.validate(load());
    if (!errors.length) console.log('valid');
    else { errors.forEach((e) => console.log(`  - ${e}`)); process.exit(2); }
    break;
  }
  case 'new': {
    if (existsSync(file)) fail(`${file} already exists`);
    const [title, artist = ''] = args;
    if (!title) fail('new needs a title');
    save({ format: N.FORMAT, title, artist, sections: null, chords: {}, youtubeUrl: '', updatedAt: 0 });
    break;
  }
  case 'chord': {
    const [bar, text = ''] = args;
    save(N.setChord(load(), bar0(bar), text));
    break;
  }
  case 'section': {
    const [bar, name] = args;
    const b = bar0(bar);
    const notes = load();
    const exists = (notes.sections || []).some((s) => s.start === b);
    save(N.setSection(notes, b, name, exists ? undefined : `s${randomBytes(4).toString('hex')}`));
    break;
  }
  case 'unsection': {
    save(N.removeSection(load(), bar0(args[0])));
    break;
  }
  default: fail(usage);
}
