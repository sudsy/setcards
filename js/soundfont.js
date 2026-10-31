/* Drum kits in SoundFont 2 files. A drum track plays from bank 128 (the General MIDI drum bank), so a kit that is stored
   in bank 0 is moved to bank 128. Only the bank number of each preset changes; the rest of the file is copied as it is.
   Works on bytes and has no DOM code, so it can be tested outside the browser. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};

  const DRUM_BANK = 128;
  const PRESET_SIZE = 38;   // name (20), program (2), bank (2), then the rest of the preset header
  const SAMPLE_SIZE = 46;   // name (20), then positions, rates and the sample type at offset 44

  // A copy of the kit that alphaTab can play: every preset is in the drum bank, and stereo samples (which it does not
  // load) are made mono. Each half of a stereo pair then plays from its own channel, placed by the preset's pan.
  const STEREO_LEFT = 4, STEREO_RIGHT = 2, MONO = 1;
  function asDrumKit(bytes) {
    const copy = new Uint8Array(bytes);
    const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
    const text = (o, n) => String.fromCharCode(...copy.subarray(o, o + n));
    if (copy.length < 12 || text(0, 4) !== 'RIFF' || text(8, 4) !== 'sfbk') throw new Error('This is not a SoundFont file');
    const pdta = findPdta(copy, view, text);
    if (!pdta) throw new Error('The SoundFont has no preset list');
    const phdr = pdta.chunks.phdr;
    if (!phdr) throw new Error('The SoundFont has no presets');
    let presets = 0;
    for (let r = phdr.start; r + PRESET_SIZE <= phdr.start + phdr.size; r += PRESET_SIZE) {
      // the last record is the end marker, which is not a preset
      if (text(r, 3) === 'EOP') continue;
      view.setUint16(r + 22, DRUM_BANK, true);
      presets++;
    }
    if (!presets) throw new Error('The SoundFont has no presets');
    const shdr = pdta.chunks.shdr;
    if (shdr) {
      for (let r = shdr.start; r + SAMPLE_SIZE <= shdr.start + shdr.size; r += SAMPLE_SIZE) {
        const type = view.getUint16(r + 44, true);
        if (type === STEREO_LEFT || type === STEREO_RIGHT) view.setUint16(r + 44, MONO, true);
      }
    }
    return copy;
  }

  // The sub-chunks of the sample data section, by name: where each starts and how long it is.
  function findPdta(copy, view, text) {
    let o = 12;
    while (o + 8 <= copy.length) {
      const size = view.getUint32(o + 4, true);
      const body = o + 8;
      if (text(o, 4) === 'LIST' && text(body, 4) === 'pdta') {
        const chunks = {};
        let p = body + 4;
        while (p + 8 <= body + size) {
          const csize = view.getUint32(p + 4, true);
          chunks[text(p, 4)] = { start: p + 8, size: csize };
          p += 8 + csize + (csize & 1);
        }
        return { chunks };
      }
      o = body + size + (size & 1);
    }
    return null;
  }

  // The drum bank numbers of a kit's presets, in order (for checks).
  function presetBanks(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const out = [];
    const text = (o, n) => String.fromCharCode(...bytes.subarray(o, o + n));
    let o = 12;
    while (o + 8 <= bytes.length) {
      const size = view.getUint32(o + 4, true);
      const body = o + 8;
      if (text(o, 4) === 'LIST' && text(body, 4) === 'pdta') {
        let p = body + 4;
        while (p + 8 <= body + size) {
          const csize = view.getUint32(p + 4, true);
          if (text(p, 4) === 'phdr') {
            for (let r = p + 8; r + PRESET_SIZE <= p + 8 + csize; r += PRESET_SIZE) out.push({ name: text(r, 20).replace(/\0.*$/, ''), bank: view.getUint16(r + 22, true) });
            return out;
          }
          p += 8 + csize + (csize & 1);
        }
      }
      o = body + size + (size & 1);
    }
    return out;
  }

  SM.soundfont = { asDrumKit, presetBanks, DRUM_BANK };
})(typeof window !== 'undefined' ? window : globalThis);
