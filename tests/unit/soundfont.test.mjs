import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// the module attaches itself to the global object, as it does in the browser
globalThis.window = undefined;
require('../../js/soundfont.js');
const { asDrumKit, presetBanks, DRUM_BANK } = globalThis.SM.soundfont;

// A minimal SoundFont 2 file: one preset in bank 0 and the end marker.
function miniKit(presets, samples = []) {
  const rec = (name, prog, bank) => {
    const b = Buffer.alloc(38);
    b.write(name, 0, 'latin1');
    b.writeUInt16LE(prog, 20);
    b.writeUInt16LE(bank, 22);
    return b;
  };
  const phdr = Buffer.concat([...presets.map((p) => rec(p.name, p.prog, p.bank)), rec('EOP', 0, 0)]);
  const chunk = (id, body) => Buffer.concat([Buffer.from(id, 'latin1'), Buffer.from(Uint32Array.of(body.length).buffer), body, body.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  const shdrBody = Buffer.concat([...samples.map((type) => { const b = Buffer.alloc(46); b.writeUInt16LE(type, 44); return b; }), Buffer.alloc(46)]);
  const pdta = Buffer.concat([Buffer.from('pdta', 'latin1'), chunk('phdr', phdr), ...(samples.length ? [chunk('shdr', shdrBody)] : [])]);
  const list = chunk('LIST', pdta);
  const info = chunk('LIST', Buffer.concat([Buffer.from('INFO', 'latin1'), chunk('ifil', Buffer.from([2, 0, 1, 0]))]));
  return new Uint8Array(Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.from(Uint32Array.of(4 + info.length + list.length).buffer), Buffer.from('sfbk', 'latin1'), info, list]));
}

test('a kit in bank 0 is moved to the drum bank, and only the bank changes', () => {
  const kit = miniKit([{ name: 'Kit', prog: 0, bank: 0 }]);
  const before = Uint8Array.from(kit);
  const drum = asDrumKit(kit);
  assert.deepEqual(presetBanks(drum), [{ name: 'Kit', bank: DRUM_BANK }, { name: 'EOP', bank: 0 }]);
  assert.deepEqual(kit, before, 'the original bytes are not changed');
  assert.equal(drum.length, kit.length);
});

test('every preset of a multi-preset kit moves to the drum bank', () => {
  const drum = asDrumKit(miniKit([{ name: 'Rock', prog: 0, bank: 0 }, { name: 'Brush', prog: 1, bank: 0 }]));
  assert.deepEqual(presetBanks(drum).map((p) => p.bank), [128, 128, 0]);
});

test('a file that is not a SoundFont is refused', () => {
  assert.throws(() => asDrumKit(new Uint8Array(Buffer.from('not a font at all, just text'))), /not a SoundFont/);
});

test('stereo samples become mono, so alphaTab plays both halves of a pair', () => {
  const kit = miniKit([{ name: 'Kit', prog: 0, bank: 0 }], [4, 2, 1]);
  const drum = asDrumKit(kit);
  const view = new DataView(drum.buffer, drum.byteOffset, drum.byteLength);
  const types = [];
  const at = Buffer.from(drum).indexOf(Buffer.from('shdr', 'latin1'));
  for (let r = at + 8; r < at + 8 + 3 * 46; r += 46) types.push(view.getUint16(r + 44, true));
  assert.deepEqual(types, [1, 1, 1]);
});
