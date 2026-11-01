/* The chord sheet of guitar edit mode, and listening to a tab part. In guitar edit mode the edit panel is one box per
   bar for the whole song, grouped by section, saved in one step. A tab part can be listened to (played alone, with the
   metronome) and its notes filled in as chords.
   create(deps) takes what the panel needs from the app:
     els                 the page elements (the panel's own ids are in it)
     state               the app state (the score, the parts and sections, the track, whether editing or playing)
     api                 the alphaTab API
     toast(text)         a message for the person
     unlockAudio()      unlocks the sound (on iPad and iPhone, before the first play)
     updateClick()       sets the metronome for the listening state
     setChords(bar, text, everywhere)   writes the chords of a bar (see the app)
     chordsChanged()     redraws the cards and saves
     chordsAt(bar)       the chords shown for a bar (the shapes, with any capo)
     capoOf()            the capo of the song
     setEditing(on)      leaves or enters edit mode
     isGuitar()          true when the guitar role is on
   refresh(editing) shows the panel for guitar edit mode and the section editor otherwise. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};

  function create(deps) {
    const { els, state, api } = deps;
    const isGuitar = () => deps.isGuitar();
    // the track picked in the tab part list (null: the track on screen), and whether it is being listened to
    let tabPart = null;
    let listening = false;
      // In guitar edit mode the edit panel is this sheet: one box for each bar, grouped by section, saved in one step.
      // Only the boxes that were changed are written; a box keeps the chords it had if it is left alone.
      function chordPanelBoxes() { return Array.from(els.chordPanelBody.querySelectorAll('input[data-bar]')); }
      // The sections are the song's parts: one for each section, a repeated section (a chorus played three times) once,
      // from its first bars. Every section is listed, even one the chosen tab part has no notes for, so chords can be
      // entered for any of them.
      function chordSheetGroups() {
        if (!state.score) return [];
        return state.groups.map((g) => {
          const p = state.parts[g.occ[0]];
          return { name: g.name, start: p.start, end: p.end };
        });
      }
      function updateChordPanel() {
        let changed = 0;
        chordPanelBoxes().forEach((box) => {
          const isChanged = box.value.trim() !== box.dataset.initial;
          const unknown = SM.chords.split(box.value).some((c) => c !== '-' && !SM.chords.parse(c));
          box.classList.toggle('changed', isChanged);
          box.classList.toggle('clash', unknown);
          if (isChanged) changed++;
        });
        els.chordPanelCount.textContent = changed ? `${changed} unsaved ${changed === 1 ? 'bar' : 'bars'}` : 'No changes';
        els.chordPanelSave.disabled = !changed;
        els.chordPanelDiscard.disabled = !changed;
      }
      // (re)builds the boxes from the chords as they are now
      function buildChordPanel() {
        if (!state.score) return;
        els.chordPanelBody.innerHTML = '';
        for (const g of chordSheetGroups()) {
          const sec = document.createElement('section');
          sec.className = 'section';
          const h = document.createElement('h2');
          h.textContent = g.name;
          const count = document.createElement('span');
          count.className = 'muted';
          count.textContent = ` ${g.end - g.start + 1} bars`;
          h.appendChild(count);
          const grid = document.createElement('div');
          grid.className = 'bars';
          for (let b = g.start; b <= g.end; b++) {
            const label = document.createElement('label');
            label.className = 'bar';
            const no = document.createElement('span');
            no.className = 'no';
            no.textContent = String(b + 1);
            const box = document.createElement('input');
            box.value = deps.chordsAt(b).join(' ');
            box.dataset.bar = String(b);
            box.dataset.initial = box.value;
            box.setAttribute('autocomplete', 'off');
            box.setAttribute('autocapitalize', 'off');
            box.setAttribute('aria-label', `Bar ${b + 1} chords`);
            label.appendChild(no);
            label.appendChild(box);
            grid.appendChild(label);
          }
          sec.appendChild(h);
          sec.appendChild(grid);
          els.chordPanelBody.appendChild(sec);
        }
        updateChordPanel();
      }
      // the edit panel shows the chord sheet in guitar, and the section editor for the other instruments
      function refresh(editing) {
        const chords = editing && isGuitar();
        els.chordPanel.hidden = !chords;
        els.sectionEdit.hidden = chords;
        // while the chords are typed in the sheet, the cards below are not shown
        document.body.classList.toggle('chord-editing', chords);
        if (chords) { buildChordPanel(); renderTabParts(); } else stopListening();
      }
      const tabPartIndex = () => {
        const n = state.score ? state.score.tracks.length : 0;
        if (tabPart !== null && tabPart >= 0 && tabPart < n) return tabPart;
        return state.trackIndex >= 0 && state.trackIndex < n ? state.trackIndex : 0;
      };
      function renderTabParts() {
        els.tabPartList.innerHTML = '';
        if (!state.score) return;
        const picked = tabPartIndex();
        state.score.tracks.forEach((t, i) => {
          if (t.isPercussion) return;
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'chip tab-part';
          b.dataset.index = String(i);
          b.setAttribute('aria-pressed', String(i === picked));
          b.textContent = t.name || `Track ${i + 1}`;
          b.addEventListener('click', () => { tabPart = i; if (listening) stopListening(); renderTabParts(); });
          els.tabPartList.appendChild(b);
        });
        els.listenBtn.setAttribute('aria-pressed', String(listening));
        els.listenBtn.textContent = listening ? 'Stop' : 'Listen';
      }
      // Plays the song with only this part, from the start, so the chords can be checked by ear.
      function startListening() {
        if (!state.score) return;
        deps.unlockAudio();
        const track = state.score.tracks[tabPartIndex()];
        api.changeTrackSolo([track], true);
        api.playbackRange = null;
        api.isLooping = false;
        if (state.playing) api.stop();   // stopping what has not started throws inside alphaTab
        api.tickPosition = 0;
        api.play();
        listening = true;
        deps.updateClick();
        renderTabParts();
      }
      function stopListening() {
        if (!listening) return;
        listening = false;
        const track = state.score && state.score.tracks[tabPartIndex()];
        if (track) api.changeTrackSolo([track], false);
        // Stop right after Listen can come before the audio has started, and alphaTab throws then; the song is stopped either way
        if (state.playing) { try { api.stop(); } catch (e) { /* not started yet */ } }
        deps.updateClick();
        renderTabParts();
      }
      // The notes of a track, bar by bar, as the chord inference reads them.
      function tabPartBars(track) {
        const staff = track.staves[0];
        return state.score.masterBars.map((mb, i) => {
          const bar = staff && staff.bars[i];
          const events = [];
          let t = 0;
          const beats = bar && bar.voices[0] ? bar.voices[0].beats : [];
          beats.forEach((beat) => {
            const dur = beat.calculateDuration ? beat.calculateDuration() : SM.chordInfer.BEAT;
            beat.notes.forEach((note) => { if (!note.isTieDestination) events.push({ pitch: note.realValue, start: t, dur }); });
            t += dur;
          });
          return { events };
        });
      }
      // Fills the boxes from the chords of the picked part. Only bars with a chord found are changed; the rest keep theirs.
      function fillChordsFromTab() {
        if (!state.score) return;
        const track = state.score.tracks[tabPartIndex()];
        const names = SM.chordInfer.inferBars(tabPartBars(track), { spell: (pc) => SM.chords.transposeName('C', pc) });
        let filled = 0;
        const filledBars = new Set();
        names.forEach((name, bar) => {
          if (!name) return;
          const box = chordPanelBoxes().find((b) => Number(b.dataset.bar) === bar);
          if (!box) return;
          // the boxes show the shapes to play, so the sounding name is moved down by any capo
          box.value = SM.chords.shapeOf(name, deps.capoOf());
          filled++;
          filledBars.add(bar);
        });
        // a part is often only written for some sections; the sections it has no notes for are marked
        const groups = chordSheetGroups();
        const sections = Array.from(els.chordPanelBody.querySelectorAll('section.section'));
        const missing = [];
        groups.forEach((g, i) => {
          const covered = [];
          for (let b = g.start; b <= g.end; b++) covered.push(filledBars.has(b));
          const has = covered.some((x) => x);
          if (!has && sections[i]) missing.push(g.name);
          const h = sections[i] && sections[i].querySelector('h2');
          if (h) h.querySelectorAll('.no-notes').forEach((x) => x.remove());
          if (!has && h) { const note = document.createElement('span'); note.className = 'no-notes fine'; note.textContent = ' no notes in this part'; h.appendChild(note); }
        });
        updateChordPanel();
        const from = `${filled} ${filled === 1 ? 'bar' : 'bars'}`;
        if (!filled) deps.toast('No chords could be found in that part');
        else if (missing.length) deps.toast(`Filled ${from}. This part has no notes for ${missing.join(', ')}. Pick another part for those.`);
        else deps.toast(`Filled ${from}. Check them, then Save chords.`);
      }
      els.listenBtn.addEventListener('click', () => { if (listening) stopListening(); else startListening(); });
      els.fillFromTabBtn.addEventListener('click', fillChordsFromTab);
      els.chordPanelBody.addEventListener('input', updateChordPanel);
      els.chordPanelBody.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !e.target.matches('input[data-bar]')) return;
        e.preventDefault();
        const boxes = chordPanelBoxes();
        const next = boxes[boxes.indexOf(e.target) + 1];
        if (next) next.focus(); else els.chordPanelSave.focus();
      });
      els.chordPanelSave.addEventListener('click', () => {
        const changed = chordPanelBoxes().filter((b) => b.value.trim() !== b.dataset.initial);
        if (!changed.length) return;
        // each box is written as typed: the repeats of a riff are not copied from here
        changed.forEach((box) => deps.setChords(Number(box.dataset.bar), box.value, false));
        deps.chordsChanged();
        buildChordPanel();
        deps.toast(changed.length === 1 ? 'Chords saved' : `Chords saved in ${changed.length} bars`);
      });
      els.chordPanelDone.addEventListener('click', () => deps.setEditing(false));
      els.chordPanelDiscard.addEventListener('click', () => {
        chordPanelBoxes().forEach((b) => { b.value = b.dataset.initial; });
        updateChordPanel();
      });
    return { refresh, isListening: () => listening, stopListening, chordPanelBoxes, updateChordPanel };
  }

  SM.chordPanel = { create };
})(typeof window !== 'undefined' ? window : globalThis);
