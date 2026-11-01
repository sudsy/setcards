/* The card view: each section of the song as a card, with its bars (chords, and a small tab when there are notes), the
   song order, and the cue sheet for vocals. The cards draw their tab snippets lazily (see startMinis in the app).
   create(deps) takes what the cards need from the app; see the names destructured below. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};

  function create(deps) {
    const { SM, els, state, role, showChords, showTabInCards, isCompact, isPaged, compactClass, applyPaged, markInView, destroyMinis, startMinis, songKeysBlock, songNoteRow, noteBlock, sectionBarRange, chordsAt, songChordNames, riffForBar, openChordDialog, playRange, plural, esc, segColor, selectView, setView, simileStarts, toggleSimile, applySimileMarks, getNote } = deps;
    function renderCards() {
      compactClass();
      // in performance mode a redraw keeps the part that was on screen
      const keep = isPaged() ? els.structure.querySelector('.step.in-view') : null;
      const keepGroup = keep && keep.dataset.group;
      destroyMinis();
      els.cards.innerHTML = '';
      applyPaged();
      if (!state.score) return;
      applySimileMarks();
      const r = role();
      const frag = document.createDocumentFragment();

      frag.appendChild(songKeysBlock());
      frag.appendChild(songNoteRow());

      if (r.cues) {
        frag.appendChild(cueSheet());
        els.cards.appendChild(frag);
        els.loading.hidden = true;
        return;
      }

      if (r.diagrams && showChords()) {
        const names = songChordNames();
        if (names.length) {
          const strip = document.createElement('section');
          strip.className = 'diagram-strip';
          strip.innerHTML = `<h3 class="card-label">Chords in this song</h3><div class="diagrams">${names.map((n) => SM.chords.diagram(n)).join('')}</div>`;
          frag.appendChild(strip);
        }
      }

      const shown = new Set();   // riffs already drawn on an earlier card
      // A part with no notes for this instrument has a card only where its chords are shown, so the chords entered
      // for it (in the chord sheet) can be seen; otherwise its chip in the song order says how many bars to wait.
      const chordOnly = (g) => g.empty && !r.cues && showChords();
      state.groups.forEach((g) => {
        if (g.empty && !chordOnly(g)) return;
        const occ = g.occ.map((i) => state.parts[i]);
        // in landscape or upright, a part with almost nothing to play (mostly rests, or no tab for this instrument)
        // gets no card of its own: fewer than a quarter of its bars have notes. Its chip stays in the song order.
        if ((isPaged() || isCompact()) && !chordOnly(g)) {
          let bars = 0;
          let withNotes = 0;
          occ.forEach((p) => p.units.forEach((u) => {
            for (let k = 0; k < u.len; k++) {
              bars++;
              if (SM.analysis.barTokens(state.score, state.trackIndex, u.start + k).length) withNotes++;
            }
          }));
          if (bars && withNotes / bars < 0.25) return;
        }
        const card = document.createElement('section');
        card.className = 'card';
        card.dataset.group = g.key;
        card.style.setProperty('--seg', segColor(g.kind));

        // How each time this part is played breaks down into riffs; identical layouts are listed once.
        const layouts = [];
        occ.forEach((p) => {
          const l = layouts.find((x) => x.summary === p.summary);
          if (l) l.occ.push(p); else layouts.push({ summary: p.summary, occ: [p] });
        });
        const ordinal = (n) => ['1st', '2nd', '3rd'][n - 1] || `${n}th`;
        const layoutHtml = layouts.map((l) => {
          const when = layouts.length > 1 ? `<span class="when">${l.occ.map((p) => ordinal(p.occNo)).join(', ')}</span>` : '';
          return `<div class="layout">${when}<span class="riff-seq">${esc(l.summary)}</span><span class="bars-note">${plural(l.occ[0].bars, 'bar')}</span></div>`;
        }).join('');

        const fills = [];
        occ.forEach((p) => p.units.forEach((u) => { if (u.variant) u.changed.forEach((b) => { if (!fills.includes(b + 1)) fills.push(b + 1); }); }));

        card.innerHTML = `
          <header class="card-head">
            <h2>${esc(g.name)}</h2>
            <span class="times">${g.occ.length > 1 ? `played ${g.occ.length} times` : 'played once'}</span>
          </header>
          ${layoutHtml}
          ${fills.length ? `<p class="fills">Small changes at bar${fills.length > 1 ? 's' : ''} ${fills.slice(0, 8).join(', ')}${fills.length > 8 ? '…' : ''}. Tap a section in the song order to see them.</p>` : ''}`;
        card.appendChild(noteBlock(g.key, g.name));
        // riffs this part uses, in order of first use
        const riffIds = [];
        occ.forEach((p) => p.units.forEach((u) => { if (!riffIds.includes(u.riff)) riffIds.push(u.riff); }));
        card.classList.toggle('single-riff', riffIds.length === 1);
        // a part with one riff gets its play button in the heading when the riff row is hidden (portrait)
        if (riffIds.length === 1 && isCompact() && state.riffs[riffIds[0]]) {
          const r = state.riffs[riffIds[0]];
          const play = document.createElement('button');
          play.type = 'button';
          play.className = 'riff-play head-play';
          play.setAttribute('aria-label', `Play ${g.name}`);
          play.title = `Play ${g.name}`;
          play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>';
          play.addEventListener('click', () => playRange(occ[0].start, occ[0].end));
          card.querySelector('.card-head').appendChild(play);
        }
        // the whole section is written out, bar by bar, including any repeats inside it
        card.appendChild(sectionBlock(occ[0], !g.empty));
        // the card's controls, under its bars: for bass, its repeats as % (an experiment)
        const actions = document.createElement('div');
        actions.className = 'card-actions';
        if (r.id === 'bass' && showTabInCards()) {
          const start = sectionBarRange(occ[0].start)[0];
          const on = simileStarts().includes(start);
          const pct = document.createElement('button');
          pct.type = 'button';
          pct.className = 'text-btn repeat-btn';
          pct.textContent = 'Repeats as %';
          pct.setAttribute('aria-pressed', String(on));
          pct.setAttribute('aria-label', `Show repeated bars in ${g.name} as %`);
          pct.title = `Show repeated bars in ${g.name} as %`;
          pct.addEventListener('click', () => toggleSimile(start));
          actions.appendChild(pct);
        }
        if (actions.children.length) card.appendChild(actions);
        riffIds.forEach((id) => shown.add(id));
        // held upright, the card is only its colour and tab; a long press opens the rest
        if (isCompact()) attachPartDetail(card, g, occ, layoutHtml, fills);
        frag.appendChild(card);
      });

      els.cards.appendChild(frag);
      els.loading.hidden = true;
      const back = keepGroup && isPaged() && els.cards.querySelector(`.card[data-group="${CSS.escape(keepGroup)}"]`);
      if (back) els.cards.scrollLeft = back.offsetLeft - els.cards.offsetLeft;
      startMinis();
      markInView();
    }

    // A long press on a part (held upright) opens its details, so the card itself stays as small as its tab.
    // Touch events, not pointer events: Safari before iOS 13 (older iPads) has no pointer events.
    function attachPartDetail(card, g, occ, layoutHtml, fills) {
      let timer = null;
      let fired = false;
      const start = (e) => {
        if (e.target.closest && e.target.closest('button, input, textarea, select, a')) return;
        fired = false;
        clearTimeout(timer);
        timer = setTimeout(() => { fired = true; openPartDetail(g, occ, layoutHtml, fills); }, 500);
      };
      const stop = () => { clearTimeout(timer); timer = null; };
      card.addEventListener('touchstart', start, { passive: true });
      card.addEventListener('touchmove', stop, { passive: true });
      card.addEventListener('touchend', stop);
      card.addEventListener('touchcancel', stop);
      card.addEventListener('mousedown', start);
      card.addEventListener('mouseup', stop);
      card.addEventListener('mouseleave', stop);
      card.addEventListener('contextmenu', (e) => e.preventDefault());
      // a long press that opened the details should not also act as a tap
      card.addEventListener('click', (e) => { if (fired) { e.preventDefault(); e.stopPropagation(); fired = false; } }, true);
    }

    function openPartDetail(g, occ, layoutHtml, fills) {
      const dlg = document.createElement('dialog');
      dlg.className = 'sheet small part-detail';
      const times = g.occ.length > 1 ? `played ${g.occ.length} times` : 'played once';
      dlg.innerHTML = `
        <div class="sheet-head"><h2></h2><button class="icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
        <p class="fine times"></p>
        <div class="detail-layout">${layoutHtml}</div>
        ${fills.length ? `<p class="fills">Small changes at bar${fills.length > 1 ? 's' : ''} ${fills.slice(0, 8).join(', ')}${fills.length > 8 ? '…' : ''}.</p>` : ''}
        <div class="detail-actions"></div>`;
      dlg.querySelector('h2').textContent = g.name;
      dlg.querySelector('.times').textContent = times;
      const actions = dlg.querySelector('.detail-actions');
      const play = document.createElement('button');
      play.type = 'button';
      play.className = 'text-btn primary';
      play.textContent = 'Play this part';
      play.addEventListener('click', () => { dlg.close(); playRange(occ[0].start, occ[0].end); });
      actions.appendChild(play);
      actions.appendChild(noteBlock(g.key, g.name));
      dlg.addEventListener('close', () => dlg.remove());
      document.body.appendChild(dlg);
      if (window.dialogPolyfill) window.dialogPolyfill.registerDialog(dlg);
      dlg.showModal();
    }

    // A part written out in full: every bar of the section in order, so repeats are shown in place.
    function sectionBlock(p, withTab = true) {
      const div = document.createElement('div');
      div.className = 'riff section-block';
      const chordCells = [];
      for (let bar = p.start; bar <= p.end; bar++) {
        const names = chordsAt(bar);
        const ri = riffForBar(bar);
        const riffId = ri ? ri.riff : '';
        const offset = ri ? ri.offset : 0;
        chordCells.push(`<button class="chord-cell" data-bar="${bar}" data-riff="${riffId}" data-offset="${offset}" title="Change the chords for bar ${bar + 1}">${names.length ? names.map(esc).join(' ') : '<span class="no-chord">+ chord</span>'}</button>`);
      }
      div.innerHTML = `
        <div class="riff-head">
          <span class="riff-len">${plural(p.bars, 'bar')}</span>
          <button class="riff-play" type="button" aria-label="Play this part" title="Play this part">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>
          </button>
        </div>
        ${showChords() ? `<div class="chord-row">${chordCells.join('<span class="bar-sep">|</span>')}</div>` : ''}`;
      div.querySelectorAll('.chord-cell').forEach((b) => b.addEventListener('click', () => openChordDialog(Number(b.dataset.bar), b.dataset.riff, Number(b.dataset.offset))));
      div.querySelector('.riff-play').addEventListener('click', () => playRange(p.start, p.end));
      if (withTab && showTabInCards()) {
        const holder = document.createElement('div');
        holder.className = 'mini-tab';
        holder.dataset.start = p.start;
        holder.dataset.len = p.bars;
        div.appendChild(holder);
      }
      return div;
    }

    // The singer's view: the song in order, with how long each section is and its first words.
    function cueSheet() {
      const list = document.createElement('ol');
      list.className = 'cue-list';
      state.parts.forEach((p, i) => {
        const cue = SM.analysis.lyricCue(state.score, p.start, p.end, 8);
        const li = document.createElement('li');
        li.className = 'cue';
        li.dataset.index = i;
        li.style.setProperty('--seg', segColor(p.kind));
        li.innerHTML = `
          <div class="cue-head"><span class="cue-name">${esc(p.label)}</span><span class="cue-bars">${plural(p.bars, 'bar')}</span></div>
          ${cue ? `<p class="cue-words">“${esc(cue)}…”</p>` : '<p class="cue-words none">No singing</p>'}
          ${showChords() && chordsAt(p.start).length ? `<p class="cue-chords">${esc(chordsAt(p.start).join(' '))}</p>` : ''}`;
        if (getNote(p.group.key) || p.occNo === 1) li.appendChild(noteBlock(p.group.key, p.group.name));
        li.addEventListener('click', () => { setView('tab'); selectView(i); });
        list.appendChild(li);
      });
      const wrap = document.createElement('section');
      wrap.className = 'cue-sheet';
      wrap.innerHTML = '<h3 class="card-label">Song order</h3>';
      wrap.appendChild(list);
      return wrap;
    }
    return { renderCards };
  }

  SM.cards = { create };
})(typeof window !== 'undefined' ? window : globalThis);
