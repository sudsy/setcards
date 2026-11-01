/* The click: the count-in and metronome volumes, and the click in drum-free bars. The click there is a side stick on
   the first beat of each drum-free bar, added to the score in memory so it plays at its exact place in the song. It is
   shown in the notation, and left out of any file that is saved or exported (see js/overlays.js).
   create(deps) takes what the click needs from the app:
     api                 the alphaTab API (volumes, rendering, MIDI reloads)
     AT                  alphaTab (its model and exporter classes)
     notes()             the song's notes (the click settings are kept in them)
     score()             the loaded score, or null
     prefs()             the device preferences (click and count-in levels, view)
     listening()         true while a tab part is being listened to (the metronome then clicks every beat)
     drumTrack()         the drum track of the score, or null
     overlays            the score overlays (js/overlays.js) the side sticks are part of */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};

  function create(deps) {
    const { api } = deps;
    const clickSetup = () => { const c = (deps.notes() && deps.notes().click) || {}; return { countIn: !!c.countIn, click: !!c.click }; };
    // the volumes are kept on this device (percent; 100 is the synth's full level)
    const clickLevel = () => (Number.isFinite(deps.prefs().clickLevel) ? deps.prefs().clickLevel : 100) / 100;
    const countInLevel = () => (Number.isFinite(deps.prefs().countInLevel) ? deps.prefs().countInLevel : 100) / 100;
    let clickBars = null;   // per bar: true when the drums have no notes in it (no drum track counts as no drums)
    function computeClickBars() {
      if (!deps.score()) { clickBars = null; return; }
      const drums = deps.drumTrack();
      const st = drums ? drums.staves[0] : null;
      clickBars = SM.drums.drumFreeBars(deps.score().masterBars.length, st ? st.bars : null, (n) => clickNotes.has(n));
    }
    // alphaTab's own metronome is kept silent: the click is the side sticks in drum-free bars (see syncClickNotes)
    function updateClick() {
      // while a tab part is being listened to, the metronome clicks every beat so the part can be followed
      const level = deps.listening() ? clickLevel() : 0;
      if (api.metronomeVolume !== level) api.metronomeVolume = level;
    }
    // The click in drum-free bars: a side stick on the first beat of each such bar, added to the score in memory so it
    // is played at its exact place in the song. It is shown in the notation, and left out of any file that is saved or
    // exported (see js/overlays.js).
    const SIDE_STICK = 37;               // General MIDI key 37, a short click the drum kit covers
    const clickNotes = new Map();        // note -> { beat, wasEmpty }
    // a track may not list a side stick among its drum sounds, so one is added to its list for the click
    let clickArt = null, clickArtList = null;
    function hideClickNotes() {
      for (const [note, c] of clickNotes) {
        const i = c.beat.notes.indexOf(note);
        if (i >= 0) c.beat.notes.splice(i, 1);
        if (c.wasEmpty) c.beat.V = true;   // back to a rest
      }
      if (clickArt && clickArtList) {
        const i = clickArtList.indexOf(clickArt);
        if (i >= 0) clickArtList.splice(i, 1);
      }
    }
    function showClickNotes() {
      if (clickArt && clickArtList && clickArtList.indexOf(clickArt) < 0) clickArtList.push(clickArt);
      for (const [note, c] of clickNotes) {
        c.beat.notes.push(note);
        if (c.wasEmpty) c.beat.V = false;  // a beat with a note is not a rest
      }
    }
    // the side sticks are an overlay: they are taken out while a file is written (see js/overlays.js)
    deps.overlays.add({ hide: hideClickNotes, show: showClickNotes });
    function syncClickNotes() {
      const had = clickNotes.size;
      hideClickNotes();
      clickNotes.clear();
      clickArt = null;
      clickArtList = null;
      const drums = deps.drumTrack();
      if (drums && clickSetup().click && clickBars) {
        const list = drums.percussionArticulations;
        let art = list.findIndex((a) => a && a.outputMidiNumber === SIDE_STICK);
        if (art < 0 && list.length) {
          // a copy of one of the track's sounds, pointed at the side stick key
          const base = list[0];
          clickArt = Object.assign(Object.create(Object.getPrototypeOf(base)), base, { outputMidiNumber: SIDE_STICK });
          clickArtList = list;
          list.push(clickArt);
          art = list.length - 1;
        }
        if (art >= 0) {
          const st = drums.staves[0];
          clickBars.forEach((free, i) => {
            const bar = st.bars[i];
            const beat = free && bar && bar.voices[0] && bar.voices[0].beats[0];
            if (!beat) return;
            const note = new deps.AT.model.Note();
            note.percussionArticulation = art;
            const wasEmpty = !!beat.isEmpty;
            clickNotes.set(note, { beat, wasEmpty });
            beat.addNote(note);
            if (wasEmpty) beat.V = false;
          });
        }
      }
      if (!clickNotes.size && clickArt) { clickArtList.splice(clickArtList.indexOf(clickArt), 1); clickArt = null; }
      if (had || clickNotes.size) {
        api.loadMidiForScore();
        if (deps.prefs().view === 'tab' && deps.score()) api.render();
      }
    }
    function applyClick() {
      if (!deps.score()) return;
      computeClickBars();
      syncClickNotes();
      const c = clickSetup();
      api.countInVolume = c.countIn ? countInLevel() : 0;
      updateClick();
    }
    return { clickSetup, clickLevel, countInLevel, computeClickBars, updateClick, applyClick, syncClickNotes, clickCount: () => clickNotes.size };
  }

  SM.click = { create };
})(typeof window !== 'undefined' ? window : globalThis);
