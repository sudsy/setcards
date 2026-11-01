/* Drum kits: the kit a song uses is read (from the band folder, this device, or the default kit with the site),
   and given to the synth. The built-in sounds are kept under the kit, and a change of kit reloads them first.
   create(deps) takes what it needs from the app:
     api                 the alphaTab API (its SoundFont loader)
     library             SM.library (where a song's kits are kept)
     soundfont           SM.soundfont (reads a kit and reports on it)
     logSound(text)      the sound log
     toast(text)         a message for the person
     drumTrack()         the drum track of the score, or null
     kitMeta()           the kit chosen for the song, or null for the default
     songKey()           the key of the song being played
     hasScore()          true once a score is loaded
     fetch(url)          fetch, for the default kit and the built-in synth
     urls                { kit, synth }: where the default kit and the built-in synth are
     oldIos              true on iOS 12 and older, which keep the built-in drums
     playback            false to use the built-in drums only */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};

  function create(deps) {
    const kitId = (meta) => (meta && meta.builtin ? 'builtin' : (meta ? (meta.fileId || meta.name) : 'default'));
    const kitReads = new Map();   // kit id -> the kit, ready for the synth (or the failure)
    let synthBytes = null;
    let appliedKit = null;        // the kit the synth has now; null while only the built-in sounds are loaded
    let applying = false;
    // iOS 12 and older (the old iPad) crashed after a few bars once the 23 MB kit was loaded, so they keep the built-in drums.
    function readKit(meta) {
      const id = kitId(meta);
      if (!kitReads.has(id)) {
        const got = meta
          ? deps.library.kits.load(deps.songKey(), meta)
          : deps.fetch(deps.urls.kit).then((r) => { if (!r.ok) throw new Error(`The default drum kit is missing (${r.status})`); return r.arrayBuffer(); }).then((b) => new Uint8Array(b));
        const read = Promise.resolve(got).then((bytes) => { if (!bytes) throw new Error('This drum kit is not on this device'); return deps.soundfont.asDrumKit(bytes); });
        read.catch(() => kitReads.delete(id));
        kitReads.set(id, read);
      }
      return kitReads.get(id);
    }
    function readSynth() {
      if (!synthBytes) synthBytes = deps.fetch(deps.urls.synth).then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b));
      return synthBytes;
    }
    // Gives the synth the drum kit this song uses. A change of kit first reloads the built-in sounds, since a second kit
    // would otherwise be added on top of the first.
    // Drum kit playback. Turned off while a silence was being found; set to false to use the built-in drums only.
    async function applyDrumKit() {
      if (!deps.playback || deps.oldIos) { deps.logSound('drum kit: not used for playback, the built-in drums play'); return; }
      if (!deps.hasScore() || !deps.drumTrack() || applying) return;
      const meta = deps.kitMeta();
      const want = kitId(meta);
      if (appliedKit === want) return;
      applying = true;
      try {
        if (want === 'builtin') {
          // the built-in drums: the synth as it came, with no kit added
          if (appliedKit !== null) deps.api.loadSoundFont(await readSynth(), false);
          appliedKit = want;
          return;
        }
        const kit = await readKit(meta);
        if (kitId(deps.kitMeta()) !== want) return;   // the song changed meanwhile
        logKitInfo(want, kit);
        if (appliedKit !== null) deps.api.loadSoundFont(await readSynth(), false);
        deps.api.loadSoundFont(kit, true);
        appliedKit = want;
      } catch (e) {
        console.error(e);
        deps.toast('That drum kit could not be loaded, so the built-in drums play');
      } finally {
        applying = false;
      }
    }
    // Debug: what the kit holds and which track it plays on, so a silent drum track can be told apart from a missing kit.
    function logKitInfo(id, kit) {
      try {
        const banks = deps.soundfont.presetBanks(kit);
        const drumBank = banks.filter((b) => b.bank === deps.soundfont.DRUM_BANK).length;
        deps.logSound(`drum kit ${id}: ${kit.length} bytes, ${banks.length} presets, ${drumBank} in drum bank`);
        deps.logSound(`drum kit presets: ${banks.slice(0, 8).map((b) => `${b.name}@${b.bank}`).join(', ')}`);
        const d = deps.drumTrack();
        if (d) deps.logSound(`drum track: "${d.name}", channel ${d.playbackInfo.primaryChannel}, program ${d.playbackInfo.program}, volume ${d.playbackInfo.volume}`);
        const mask = deps.soundfont.keysCovered(kit);
        const covered = Array.from(mask).reduce((n, v) => n + v, 0);
        const span = [...mask.keys()].filter((k) => mask[k]);
        deps.logSound(`kit keys: ${covered} keys with samples${span.length ? `, ${span[0]} to ${span[span.length - 1]}` : ''}; metronome key 33 ${mask[33] ? 'covered' : 'NOT covered'}`);
        if (d) {
          const outside = {};
          let inside = 0, total = 0;
          for (const staff of d.staves) for (const bar of staff.bars) for (const voice of bar.voices) for (const beat of voice.beats) for (const note of beat.notes) {
            total++;
            // a drum note's real value is its string and fret, so its MIDI key comes from the track's drum list
            const key = note.isPercussion ? ((d.percussionArticulations[note.percussionArticulation] || {}).outputMidiNumber ?? -1) : note.realValue;
            if (key >= 0 && key < 128 && mask[key]) inside++; else outside[key] = (outside[key] || 0) + 1;
          }
          const list = Object.keys(outside).map(Number).sort((a, b) => a - b).slice(0, 12).map((k) => `${k}x${outside[k]}`);
          deps.logSound(`drum notes: ${total} total, ${inside} on covered keys, ${total - inside} not covered${list.length ? ` (keys: ${list.join(' ')})` : ''}`);
        }
      } catch (e) {
        deps.logSound(`drum kit info failed: ${e && e.message}`);
      }
    }
    return { applyDrumKit, readKit, kitId, logKitInfo };
  }

  SM.kits = { create };
})(typeof window !== 'undefined' ? window : globalThis);
