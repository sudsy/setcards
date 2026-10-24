/* Setcards: Guitar Pro songs as short section cards for every player in the band. */
(function () {
  'use strict';
  const AT = window.alphaTab;
  const SM = window.SM;
  const $ = (id) => document.getElementById(id);

  const els = {
    songTitle: $('songTitle'), songMeta: $('songMeta'),
    structure: $('structure'),
    viewCards: $('viewCards'), viewTab: $('viewTab'), viewCardsTop: $('viewCardsTop'), viewTabTop: $('viewTabTop'), roleBtn: $('roleBtn'),
    sectionHead: $('sectionHead'), sectionName: $('sectionName'), sectionBars: $('sectionBars'),
    prevBtn: $('prevBtn'), nextBtn: $('nextBtn'),
    editBtn: $('editBtn'), editPanel: $('editPanel'), sectionList: $('sectionList'),
    findRepeatsBtn: $('findRepeatsBtn'), suggestBtn: $('suggestBtn'), useMarkersBtn: $('useMarkersBtn'), doneEditBtn: $('doneEditBtn'),
    syncBtn: $('syncBtn'), scroller: $('scroller'), tab: $('tab'), cards: $('cards'), loading: $('loading'), drop: $('drop'), banner: $('banner'),
    playBtn: $('playBtn'), loopBtn: $('loopBtn'), speedSel: $('speedSel'),
    videoBtn: $('videoBtn'), videoPanel: $('videoPanel'), playerStatus: $('playerStatus'),
    homeView: $('homeView'), songView: $('songView'), backBtn: $('backBtn'), bandName: $('bandName'), homeRoleBtn: $('homeRoleBtn'),
    bandBtn: $('bandBtn'), bandDlg: $('bandDlg'), driveBox: $('driveBox'), modeBox: $('modeBox'),
    welcome: $('welcome'), welcomeRoles: $('welcomeRoles'), welcomeMode: $('welcomeMode'), chooseBand: $('chooseBand'), chooseSolo: $('chooseSolo'), bandBox: $('bandBox'), songListWrap: $('songListWrap'),
    fileInput: $('fileInput'), shareUpload: $('shareUpload'), shareUploadWrap: $('shareUploadWrap'),
    originalKeyInput: $('originalKeyInput'), bandKeyInput: $('bandKeyInput'), tabKeyInput: $('tabKeyInput'), keyInfo: $('keyInfo'),
    bandTrDown: $('bandTrDown'), bandTrUp: $('bandTrUp'), bandTrOut: $('bandTrOut'), matchKeyBtn: $('matchKeyBtn'),
    myTrDown: $('myTrDown'), myTrUp: $('myTrUp'), myTrOut: $('myTrOut'), myTrReset: $('myTrReset'),
    tempoInput: $('tempoInput'), statusSel: $('statusSel'), noTab: $('noTab'),
    addSongBtn: $('addSongBtn'), addDlg: $('addDlg'), addForm: $('addForm'), addTitle: $('addTitle'), addArtist: $('addArtist'),
    addYt: $('addYt'), addStatus: $('addStatus'),
    noteDlg: $('noteDlg'), noteTitle: $('noteTitle'), noteHint: $('noteHint'), noteForm: $('noteForm'), noteText: $('noteText'), noteClear: $('noteClear'),
    settingsBtn: $('settingsBtn'), settingsDlg: $('settingsDlg'), trackSel: $('trackSel'),
    zoomRange: $('zoomRange'), zoomOut: $('zoomOut'), ytInput: $('ytInput'), exportBtn: $('exportBtn'), showTabCards: $('showTabCards'), showChords: $('showChords'),
    barDlg: $('barDlg'), barDlgTitle: $('barDlgTitle'), barDlgText: $('barDlgText'),
    presetRow: $('presetRow'), barForm: $('barForm'), barName: $('barName'), barSubmit: $('barSubmit'), barRemove: $('barRemove'),
    barChords: $('barChords'), barChordsAll: $('barChordsAll'), barChordsAllLabel: $('barChordsAllLabel'),
    chordDlg: $('chordDlg'), chordDlgTitle: $('chordDlgTitle'), chordForm: $('chordForm'), chordInput: $('chordInput'),
    chordAll: $('chordAll'), chordAllLabel: $('chordAllLabel'), chordClear: $('chordClear'), chordPreview: $('chordPreview'),
    roleDlg: $('roleDlg'), roleList: $('roleList'),
    joinDlg: $('joinDlg'), joinTitle: $('joinTitle'), joinBtn: $('joinBtn'),
    toast: $('toast')
  };

  const PRESETS = ['Intro', 'Verse', 'Pre-chorus', 'Chorus', 'Bridge', 'Solo', 'Outro'];
  const STAVES = { tab: AT.StaveProfile.Tab, scoretab: AT.StaveProfile.ScoreTab, score: AT.StaveProfile.Score };
  const ROLES = [
    { id: 'bass', label: 'Bass', cardsTab: true, chords: false, offer: 'Tab for each riff, shown once' },
    { id: 'guitar', label: 'Guitar', cardsTab: false, diagrams: true, offer: 'Chord names and shapes' },
    { id: 'keys', label: 'Keys', cardsTab: false },
    { id: 'vocals', label: 'Vocals', cardsTab: false, cues: true, offer: 'Song order with lyric cues' },
    { id: 'drums', label: 'Drums', cardsTab: false }
  ];

  /* ---------------- per-device preferences ---------------- */
  const prefs = Object.assign({ role: 'bass', view: 'cards', zoom: 1, stave: 'tab', last: null, tracks: {}, cardsTab: {}, chords: {}, transpose: {} }, readJson('setcards:prefs'));
  prefs.chords = prefs.chords || {};
  prefs.transpose = prefs.transpose || {};
  function readJson(k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } }
  function savePrefs() { try { localStorage.setItem('setcards:prefs', JSON.stringify(prefs)); } catch (e) { /* storage unavailable */ } }
  const role = () => ROLES.find((r) => r.id === prefs.role) || ROLES[0];
  const showTabInCards = () => (prefs.cardsTab[prefs.role] ?? role().cardsTab);
  // Chord names are hidden for bass unless turned on; everyone else sees them.
  const showChords = () => (prefs.chords[prefs.role] ?? (role().chords !== false));

  const state = {
    song: null,         // { key, title, artist, fileName, canShare, localOnly }
    notes: null,        // shared notes: sections, chords, youtubeUrl
    score: null,
    trackIndex: 0,
    fileMarkers: [],
    fileChords: {},
    parts: [],          // every section occurrence in song order
    groups: [],         // distinct parts (Verse, Chorus…)
    riffs: {},          // riff id -> { id, start, len, uses }
    view: -1,           // selected occurrence in the tab view, -1 = whole song
    editing: false,
    loop: true,
    playing: false,
    playingPart: -1,
    videoOn: false,
    barDlgIndex: 0,
    noteEdit: null,
    chordEdit: null
  };

  let updateWaiting = false;   // a new version of the app is ready and will load at the next good moment
  let ytPlayer = null;
  let ytReady = false;
  let ytApi = null;
  let minis = [];       // small alphaTab renderers inside the cards
  let miniObserver = null;

  /* ---------------- helpers ---------------- */
  let toastTimer = 0;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2800);
  }
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  // Timings for opening a song, shown after the song loads until they are dismissed. Shown again on each song opened.
  const diag = {
    t0: 0, marks: [], drawn: 0, done: 0, last: 0, box: null, dismissed: false,
    start() {
      this.t0 = performance.now(); this.marks = []; this.drawn = 0; this.done = 0; this.last = 0;
      this.dismissed = false;
      this.mark('opening');
    },
    mark(name) {
      if (!this.t0) return;
      this.marks.push(`${name} ${Math.round(performance.now() - this.t0)} ms`);
      this.show();
    },
    // the panel is for the song screen, so it is out of the way on the song list
    hide() { if (this.box) this.box.hidden = true; },
    miniDrawn() { if (this.t0) { this.drawn++; this.show(); } },
    miniDone() { if (this.t0) { this.done++; this.last = Math.round(performance.now() - this.t0); this.show(); } },
    show() {
      if (this.dismissed) return;
      if (!this.box) {
        this.box = document.createElement('div');
        this.box.className = 'diag';
        this.box.innerHTML = '<div class="diag-head"><strong>Opening timings</strong><button type="button" class="diag-close" aria-label="Dismiss timings">Dismiss</button></div><pre class="diag-body"></pre>';
        this.box.querySelector('.diag-close').addEventListener('click', () => { this.dismissed = true; this.box.hidden = true; });
        document.body.appendChild(this.box);
      }
      this.box.hidden = false;
      const minis = this.drawn ? [`part tabs drawn ${this.drawn}, finished ${this.done}, last at ${this.last} ms`] : [];
      this.box.querySelector('.diag-body').textContent = [...this.marks, ...minis].join('\n');
    }
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function kindOf(name) {
    const n = (name || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (/pre ?chorus|build|lift|channel/.test(n)) return 'pre';
    if (/chorus|refrain|hook/.test(n)) return 'chorus';
    if (/verse/.test(n)) return 'verse';
    if (/intro|count in|pickup|start/.test(n)) return 'intro';
    if (/outro|ending|coda|\bend\b|fade|tag/.test(n)) return 'outro';
    if (/bridge|middle/.test(n)) return 'bridge';
    if (/solo|instrumental|interlude|break|riff|jam|fill/.test(n)) return 'solo';
    let h = 0;
    for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return 'other' + (1 + (h % 3));
  }
  const segColor = (kind) => `var(--c-${kind})`;

  function fmtTime(sec) {
    if (sec == null || isNaN(sec)) return '';
    return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  }
  function parseTime(str) {
    const t = (str || '').trim();
    if (!t) return null;
    const parts = t.split(':').map(Number);
    if (parts.some(isNaN)) return undefined;
    return parts.reduce((acc, v) => acc * 60 + v, 0);
  }
  function youtubeId(url) {
    const u = (url || '').trim();
    if (!u) return null;
    const m = u.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    return /^[A-Za-z0-9_-]{11}$/.test(u) ? u : null;
  }
  function hexToColor(hex) {
    const h = hex.trim().replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return new AT.model.Color((n >> 16) & 255, (n >> 8) & 255, n & 255, 255);
  }
  // "Verse 2", "Chorus (x2)" and "Chorus" all belong to the same part of the song.
  function baseName(name) {
    const n = (name || '').trim()
      .replace(/\s*[(\[]?\s*x\s*\d+\s*[)\]]?$/i, '')
      .replace(/\s*[(\[]?\s*(\d+|[ivx]+)\s*[)\]]?$/i, '')
      .trim();
    return n || (name || '').trim() || 'Section';
  }
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  /* ---------------- saving notes ---------------- */
  // Saves are grouped for a moment so typing doesn't write on every key, and flushed when the page
  // is hidden or closed so nothing is lost.
  let saveTimer = 0;
  let pendingSave = null;
  function saveNotes() {
    if (!state.song) return;
    clearTimeout(saveTimer);
    const key = state.song.key;
    const notes = state.notes;
    notes.title = state.song.title;
    notes.artist = state.song.artist;
    const run = async () => {
      if (pendingSave === run) pendingSave = null;
      const r = await SM.library.saveNotes(key, notes);
      if (r.error) toast('Saved on this device only. The band folder could not be reached.');
      if (state.song && state.song.key === key) {
        state.song.localOnly = r.local && !state.song.canShare;
        updateBanner();
      }
    };
    pendingSave = run;
    pendingSave.key = key;
    pendingSave.notes = notes;
    // Each save to Drive becomes a version of the file, and Drive keeps only the last 100, so edits are
    // gathered for a few seconds there; leaving the song or the page saves straight away.
    const delay = key.startsWith('drive:') ? 4000 : 400;
    saveTimer = setTimeout(() => pendingSave && pendingSave(), delay);
  }
  // Returns a promise that settles once the save has been written.
  function flushSave(leaving) {
    clearTimeout(saveTimer);
    if (!pendingSave) return Promise.resolve();
    // The page may close before the real save finishes, so keep an instant copy that wins on next open.
    if (leaving === true) SM.library.overlay.set(pendingSave.key, Object.assign({}, pendingSave.notes, { updatedAt: Date.now() }));
    return pendingSave();
  }
  window.addEventListener('pagehide', () => flushSave(true));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(true); });

  // Under the title: where the song lives, who it's by, and its key and tempo.
  function updateSongMeta() {
    if (!state.song) return;
    const key = state.song.key;
    const place = key.startsWith('drive:') ? 'Band' : (key.startsWith('local:') && prefs.mode === 'band' ? 'Draft, only on this device' : '');
    const m = (state.notes && state.notes.meta) || {};
    const keys = keysOf(state.notes);
    const tr = state.song.hasTab !== false ? transposeSemis() : 0;
    const k = [keys.band || (m.key ? m.key + (m.keyGuessed ? '?' : '') : ''), tr ? `tab ${signed(tr)}` : ''].filter(Boolean).join(', ');
    const t = (state.notes && state.notes.tempo) || m.tempo;
    const st = state.notes && STATUS_LABELS[state.notes.status] && state.notes.status !== 'ready' ? STATUS_LABELS[state.notes.status] : '';
    els.songMeta.textContent = [place, st, state.song.artist, k, t ? `${t} bpm` : ''].filter(Boolean).join(' · ') || state.song.fileName || '';
  }

  function updateBanner() {
    const s = state.song;
    const msgs = [];
    if (s && s.offline) msgs.push('Offline: this is the copy saved on this phone. Changes are kept here and sent to the band when you’re back online.');
    else if (s && s.localOnly) msgs.push('Your changes to this song are saved in this browser only. Add the song to a band folder to share them.');
    if (s && state.score && state.partMissing) msgs.push(missingPartText());
    els.banner.hidden = !msgs.length;
    els.banner.textContent = msgs.join(' ');
  }
  function missingPartText() {
    const tracks = state.score.tracks;
    const t = tracks[state.trackIndex];
    const what = role().label.toLowerCase();
    // say what kind of part it is; a track is often named after the song, which says nothing
    const kind = ['guitar', 'keys', 'vocals', 'drums'].find((r) => t && trackMatches(t, r));
    const part = kind ? `the ${ROLES.find((r) => r.id === kind).label.toLowerCase()} part` : 'another part';
    return tracks.length > 1
      ? `No ${what} part in this tab, so it shows ${part}. You can pick a different part in Settings.`
      : `This tab only has ${part}, with no ${what} part, so that is what’s shown here.`;
  }

  /* ---------------- chords ---------------- */
  // User chords override what the file says, bar by bar. "-" means no chord in that bar.
  /* ---------------- keys and transposing ---------------- */
  // Three keys per song, shared with the band: the recording's, the one the band plays in, and the tab's.
  const keysOf = (notes) => {
    const n = notes || {};
    const m = n.meta || {};
    return {
      original: n.originalKey || '',
      band: n.bandKey || n.key || '',
      tab: n.tabKey || m.key || '',
      tabGuessed: !n.tabKey && !!m.keyGuessed
    };
  };
  // How far the tab is moved: this device's choice if set, otherwise the band's.
  const bandTranspose = () => (state.notes && Number(state.notes.transpose)) || 0;
  const myTranspose = () => (state.song ? prefs.transpose[state.song.key] : undefined);
  const transposeSemis = () => (myTranspose() ?? bandTranspose());
  const signed = (n) => (n > 0 ? `+${n}` : String(n));

  // Plain words about the keys: how the band's key compares with the recording and the tab.
  function keyInfoText() {
    const k = keysOf(state.notes);
    const t = transposeSemis();
    const lines = [];
    const vsOriginal = SM.chords.semitonesBetween(k.original, k.band);
    const kn = SM.chords.keyName;
    if (vsOriginal) lines.push(`The band plays this ${Math.abs(vsOriginal)} semitone${Math.abs(vsOriginal) === 1 ? '' : 's'} ${vsOriginal < 0 ? 'lower' : 'higher'} than the recording.`);
    else if (vsOriginal === 0) lines.push('The band plays this in the original key.');
    if (state.song && state.song.hasTab && k.tab) {
      const shown = SM.chords.transposeName(k.tab, t);
      lines.push(t ? `The tab is in ${kn(k.tab)}${k.tabGuessed ? ' (estimated)' : ''}, shown ${signed(t)} in ${kn(shown)}.` : `The tab is in ${kn(k.tab)}${k.tabGuessed ? ' (estimated)' : ''}.`);
      const toBand = SM.chords.semitonesBetween(shown, k.band);
      if (k.band && toBand) lines.push(`That is ${Math.abs(toBand)} semitone${Math.abs(toBand) === 1 ? '' : 's'} ${toBand < 0 ? 'above' : 'below'} the band key. Match band key fixes it.`);
    }
    return lines.join(' ');
  }

  // The keys at the top of the whole song: what the band plays in, the recording, and the key the tab is shown in.
  function songKeys() {
    const k = keysOf(state.notes);
    const kn = SM.chords.keyName;
    const out = [];
    const t = state.song && state.song.hasTab !== false ? transposeSemis() : 0;
    if (k.band) out.push({ label: 'Band key', value: kn(k.band) });
    if (k.original) {
      const d = k.band ? SM.chords.semitonesBetween(k.original, k.band) : 0;
      out.push({ label: 'Original', value: kn(k.original), note: d ? `band ${signed(d)}` : '' });
    }
    if (state.score && k.tab) {
      const shown = SM.chords.transposeName(k.tab, t);
      if (t) out.push({ label: 'Tab shown in', value: kn(shown), note: `${signed(t)} from ${kn(k.tab)}` });
      else if (!k.band || SM.chords.semitonesBetween(k.tab, k.band) !== 0 || k.tabGuessed) out.push({ label: 'Tab in', value: kn(k.tab), note: k.tabGuessed ? 'estimated' : '' });
    }
    return out;
  }
  function songKeysBlock() {
    const keys = songKeys();
    const el = document.createElement('section');
    el.className = 'song-keys';
    el.hidden = !keys.length;
    keys.forEach((k) => {
      const d = document.createElement('div');
      d.innerHTML = '<span class="k-label"></span><span class="k-value"></span>';
      d.querySelector('.k-label').textContent = k.label;
      d.querySelector('.k-value').textContent = k.value;
      if (k.note) {
        const n = document.createElement('span');
        n.className = 'k-note';
        n.textContent = k.note;
        d.appendChild(n);
      }
      el.appendChild(d);
    });
    return el;
  }
  // The key being played, in words, for the section heading of the whole song.
  function playingKeyName() {
    const k = keysOf(state.notes);
    if (state.score && k.tab) return SM.chords.keyName(SM.chords.transposeName(k.tab, transposeSemis())) + (k.tabGuessed && !k.band ? '?' : '');
    return k.band ? SM.chords.keyName(k.band) : '';
  }

  // Chords are stored in the tab's own key and shown in the key the tab is transposed to.
  function chordsAt(bar) {
    const own = state.notes && state.notes.chords && state.notes.chords[bar];
    if (own != null) return own === '-' ? [] : SM.chords.split(own).map((c) => SM.chords.transposeName(c, transposeSemis()));
    return (state.fileChords[bar] || []).map((c) => c.name);
  }
  function songChordNames() {
    const seen = [];
    if (!state.score) return seen;
    for (let i = 0; i < state.score.masterBars.length; i++) {
      chordsAt(i).forEach((c) => { if (!seen.includes(c)) seen.push(c); });
    }
    return seen;
  }

  /* ---------------- sections and riffs ---------------- */
  function markersFromScore(score) {
    const out = [];
    score.masterBars.forEach((mb, i) => {
      if (mb.section) out.push({ id: uid(), start: i, name: (mb.section.text || mb.section.marker || '').trim() || 'Section' });
    });
    return out;
  }

  function sortedSections() {
    const n = state.score ? state.score.masterBars.length : 0;
    return (state.notes.sections || []).filter((s) => s.start >= 0 && s.start < n).sort((a, b) => a.start - b.start);
  }

  function deriveParts() {
    const mbs = state.score.masterBars;
    const list = sortedSections();
    const startsAt = {};
    list.forEach((s) => { startsAt[s.start] = s; });
    const sectionOf = (bar) => { let found = null; list.forEach((s) => { if (s.start <= bar) found = s; }); return found; };
    // Sections are marked on the written bars; the song order follows the repeats, so a section inside
    // repeat signs is played (and listed) again on each pass.
    const order = SM.analysis.playOrder(state.score);
    const parts = [];
    const seen = new Set();
    let tick = 0;
    state.firstTick = {};
    order.forEach((bar, k) => {
      const len = mbs[bar].calculateDuration();
      if (state.firstTick[bar] == null) state.firstTick[bar] = tick;
      const last = parts[parts.length - 1];
      if (last && bar === order[k - 1] + 1 && !startsAt[bar]) {
        last.end = bar;
        last.playEnd = tick + len;
      } else {
        const sec = sectionOf(bar);
        parts.push({ name: sec ? sec.name : (list.length ? 'Pickup' : 'Whole song'), start: bar, end: bar, ref: sec || undefined,
          synthetic: !sec, again: seen.has(bar), playStart: tick, playEnd: tick + len });
      }
      seen.add(bar);
      tick += len;
    });

    const groups = [];
    const byKey = {};
    parts.forEach((p, i) => {
      p.bars = p.end - p.start + 1;
      const name = baseName(p.name);
      const key = name.toLowerCase();
      let g = byKey[key];
      if (!g) {
        g = byKey[key] = { key, name, kind: p.synthetic ? 'intro' : kindOf(name), occ: [] };
        groups.push(g);
      }
      p.group = g;
      p.kind = g.kind;
      p.label = g.name;
      g.occ.push(i);
      p.occNo = g.occ.length;
    });

    // Sections with no name Setcards knows (Part A, B, C…) each get their own colour, in order of first appearance
    let unnamed = 0;
    groups.forEach((g) => {
      if (!/^other/.test(g.kind)) return;
      unnamed++;
      g.kind = 'x' + ((unnamed - 1) % 8 + 1);
      g.occ.forEach((i) => { parts[i].kind = g.kind; });
    });

    // Repeating riffs inside each section, from the track this person plays.
    const res = SM.analysis.analyse(state.score, state.trackIndex, parts, chordsAt, parts.map((p) => p.ref && p.ref.unit));
    state.riffs = {};
    res.riffs.forEach((r) => { state.riffs[r.id] = r; });
    parts.forEach((p, i) => {
      p.units = res.parts[i].units;
      p.unit = res.parts[i].unit;
      p.summary = res.parts[i].summary;
      // nothing to play here on this instrument (the bass sitting out the intro)
      p.empty = p.units.length > 0 && p.units.every((u) => state.riffs[u.riff] && state.riffs[u.riff].empty);
    });
    groups.forEach((g) => { g.empty = g.occ.every((i) => parts[i].empty); });
    state.parts = parts;
    state.groups = groups;
  }

  // The first time a written bar is played (a bar inside repeat signs is in more than one part).
  function partIndexForBar(bar) {
    const i = state.parts.findIndex((p) => p.start <= bar && bar <= p.end);
    if (i >= 0) return i;
    for (let j = state.parts.length - 1; j >= 0; j--) if (state.parts[j].start <= bar) return j;
    return -1;
  }
  // The part playing at a point in the playback, which counts repeats.
  const partIndexForTick = (tick) => state.parts.findIndex((p) => p.playStart <= tick && tick < p.playEnd);

  // Every bar where a given bar of a riff is played (used to copy chords to each repeat).
  function riffBars(riffId, offset) {
    const out = [];
    state.parts.forEach((p) => p.units.forEach((u) => { if (u.riff === riffId && offset < u.len) out.push(u.start + offset); }));
    return [...new Set(out)];
  }
  function riffForBar(bar) {
    const p = state.parts[partIndexForBar(bar)];
    if (!p) return null;
    const u = p.units.find((x) => bar >= x.start && bar < x.start + x.len);
    return u ? { riff: u.riff, offset: bar - u.start, unit: u } : null;
  }

  /* ---------------- writing annotations into the score ---------------- */
  // Section names, riff letters and chord names are put into the alphaTab model so they show in the tab
  // and are included when the annotated file is downloaded. Original values are kept to restore later.
  const original = { text: new Map(), chord: new Map() };
  const addedChordIds = new Set();

  function applyAnnotations() {
    const score = state.score;
    score.masterBars.forEach((mb) => { mb.section = null; });
    sortedSections().forEach((s) => {
      const sec = new AT.model.Section();
      sec.text = s.name;
      sec.marker = '';
      score.masterBars[s.start].section = sec;
    });

    original.text.forEach((v, beat) => { beat.text = v; });
    original.chord.forEach((v, beat) => { beat.chordId = v; });
    original.text.clear();
    original.chord.clear();

    const staff = score.tracks[state.trackIndex].staves[0];
    const barTotal = (i) => score.masterBars[i].calculateDuration() || 1;
    const beatsOf = (i) => (staff.bars[i] ? staff.bars[i].voices[0].beats : []);
    const setText = (beat, text) => { if (!original.text.has(beat)) original.text.set(beat, beat.text); beat.text = text; };
    const setChord = (beat, id) => { if (!original.chord.has(beat)) original.chord.set(beat, beat.chordId); beat.chordId = id; };

    // riff letters on the first beat of every repeat
    state.parts.forEach((p) => {
      const first = p.units[0] && state.riffs[p.units[0].riff];
      if (p.units.length < 2 && !(first && first.uses > 1)) return;
      p.units.forEach((u) => {
        const b = beatsOf(u.start)[0];
        if (b) setText(b, u.variant ? `${u.riff}′` : u.riff);
      });
    });

    // chord names, placed on the beat nearest each chord's position in the bar
    for (let i = 0; i < score.masterBars.length; i++) {
      const own = state.notes.chords[i];
      const fromFile = state.fileChords[i] || [];
      const names = chordsAt(i);
      if (!names.length) continue;
      const positions = own != null ? names.map((_, k) => k / names.length) : fromFile.map((c) => c.pos);
      const beats = beatsOf(i);
      names.forEach((name, k) => {
        const id = 'sc:' + name;
        if (!staff.chords || !staff.chords.has(id)) {
          const ch = new AT.model.Chord();
          ch.name = name;
          ch.showDiagram = false;
          ch.showName = true;
          staff.addChord(id, ch);
          addedChordIds.add(id);
        }
        const target = positions[k] * barTotal(i);
        let best = beats[0];
        beats.forEach((b) => { if (b.playbackStart <= target + 1) best = b; });
        if (best) setChord(best, id);
      });
    }
  }

  /* ---------------- song map ---------------- */
  // The song order is the only map: in Cards it jumps to that part's card, in Full tab it shows that section.
  function renderMap() {
    els.structure.innerHTML = '';
    const whole = document.createElement('button');
    whole.className = 'step whole';
    whole.dataset.index = -1;
    whole.textContent = 'Whole song';
    whole.title = `${state.score.masterBars.length} bars`;
    whole.addEventListener('click', () => {
      if (prefs.view === 'cards') els.scroller.scrollTo({ top: 0, behavior: 'smooth' });
      else selectView(-1);
    });
    els.structure.appendChild(whole);
    state.parts.forEach((p, i) => {
      const t = document.createElement('button');
      t.className = 'step';
      t.style.setProperty('--seg', segColor(p.kind));
      t.dataset.index = i;
      t.dataset.group = p.group.key;
      t.dataset.bars = p.bars;   // shown after the name, so you know how long to wait
      t.classList.toggle('rest', !!p.empty && !role().cues);
      t.textContent = p.label;
      t.title = `${p.label} · ${plural(p.bars, 'bar')} · bars ${p.start + 1}–${p.end + 1}${p.empty ? ' · nothing to play' : ` · ${p.summary}`}`;
      t.addEventListener('click', () => {
        if (prefs.view === 'cards') scrollToCard(i);
        else selectView(i);
      });
      els.structure.appendChild(t);
    });
    if (!sortedSections().length) {
      const hint = document.createElement('span');
      hint.className = 'fine';
      hint.style.margin = '4px 0';
      hint.textContent = 'No sections yet. Tap Edit to mark the verse, chorus and so on, or let Setcards suggest them.';
      els.structure.appendChild(hint);
    }
    refreshChipStates();
    updateHeader();
  }

  function scrollToCard(partIndex) {
    // a part with nothing to play has no card: go to the next one that has
    let i = partIndex;
    const cardFor = (k) => els.cards.querySelector(`.cue[data-index="${k}"]`) || els.cards.querySelector(`.card[data-group="${CSS.escape(state.parts[k].group.key)}"]`);
    while (i < state.parts.length - 1 && !cardFor(i)) i++;
    const target = cardFor(i);
    if (!target) return;
    if (isPaged()) {
      pagedTarget = target.dataset.group;
      els.cards.scrollTo({ left: target.offsetLeft - els.cards.offsetLeft, behavior: 'smooth' });
      target.classList.remove('flash');
      void target.offsetWidth;
      target.classList.add('flash');
      return;
    }
    // Tab snippets above the card can still be drawing and change height, so re-align once they settle.
    const align = () => { els.scroller.scrollTop = target.offsetTop - 8; };
    align();
    setTimeout(align, 250);
    setTimeout(align, 700);
    target.classList.remove('flash');
    void target.offsetWidth;
    target.classList.add('flash');
  }

  function updateHeader() {
    const n = state.score.masterBars.length;
    if (state.view === -1) {
      els.sectionName.textContent = 'Whole song';
      els.sectionBars.textContent = [`${n} bars`, plural(state.parts.length, 'section'), playingKeyName()].filter(Boolean).join(' · ');
    } else {
      const p = state.parts[state.view];
      const bits = [];
      if (p.group.occ.length > 1) bits.push(`${p.occNo} of ${p.group.occ.length}`);
      bits.push(`bars ${p.start + 1}–${p.end + 1}`);
      bits.push(p.summary);
      els.sectionName.textContent = p.label;
      els.sectionBars.textContent = bits.join(' · ');
    }
    els.prevBtn.disabled = state.view <= -1;
    els.nextBtn.disabled = state.view >= state.parts.length - 1;
  }

  function refreshChipStates() {
    const cur = prefs.view === 'tab' ? state.parts[state.view] : null;
    els.structure.querySelectorAll('.step').forEach((t) => {
      const i = Number(t.dataset.index);
      t.setAttribute('aria-current', prefs.view === 'tab' && i === state.view ? 'true' : 'false');
      t.classList.toggle('same', !!(cur && i >= 0 && i !== state.view && state.parts[i].group === cur.group));
      t.classList.toggle('playing', i >= 0 && i === state.playingPart);
    });
  }


  /* ---------------- cards (the quick reference) ---------------- */
  function destroyMinis() {
    if (miniObserver) miniObserver.disconnect();
    minis.forEach((m) => { try { m.destroy(); } catch (e) { /* already gone */ } });
    minis = [];
  }

  /* ---------------- instrument notes ---------------- */
  // Shared with the band and kept with the song, one set per instrument:
  // notes.roleNotes = { bass: { song: '…', parts: { verse: '…' } }, guitar: {…} }
  function getNote(partKey) {
    const r = (state.notes.roleNotes || {})[prefs.role] || {};
    return (partKey ? (r.parts || {})[partKey] : r.song) || '';
  }
  function setNote(partKey, text) {
    const all = state.notes.roleNotes = state.notes.roleNotes || {};
    const r = all[prefs.role] = all[prefs.role] || { song: '', parts: {} };
    r.parts = r.parts || {};
    if (partKey) { if (text) r.parts[partKey] = text; else delete r.parts[partKey]; } else r.song = text;
    saveNotes();
  }

  // A note, or a small button to add one. partKey null means the note for the whole song.
  function noteBlock(partKey, partName) {
    const text = getNote(partKey);
    const label = `${role().label} note`;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = text ? 'role-note' : 'add-note';
    if (text) {
      el.innerHTML = '<span class="role-note-label"></span><span class="role-note-text"></span>';
      el.querySelector('.role-note-label').textContent = partName ? label : `${label} for the song`;
      el.querySelector('.role-note-text').textContent = text;
    } else {
      el.textContent = partName ? `+ ${label}` : `+ ${label} for the whole song`;
    }
    el.addEventListener('click', (e) => { e.stopPropagation(); openNoteDialog(partKey, partName); });
    return el;
  }

  function openNoteDialog(partKey, partName) {
    state.noteEdit = partKey;
    els.noteTitle.textContent = `${role().label} note · ${partName || 'whole song'}`;
    els.noteHint.textContent = `Everyone sees this in the ${role().label.toLowerCase()} view, on any device.`;
    els.noteText.value = getNote(partKey);
    els.noteDlg.showModal();
    setTimeout(() => els.noteText.focus(), 50);
  }
  els.noteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    setNote(state.noteEdit, els.noteText.value.trim());
    closeDialog(els.noteDlg);
    if (state.song && !state.song.hasTab) renderNoTab(); else renderCards();
  });
  els.noteClear.addEventListener('click', () => { els.noteText.value = ''; });

  function renderCards() {
    compactClass();
    // in performance mode a redraw keeps the part that was on screen
    const keep = isPaged() ? els.structure.querySelector('.step.in-view') : null;
    const keepGroup = keep && keep.dataset.group;
    destroyMinis();
    els.cards.innerHTML = '';
    applyPaged();
    if (!state.score) return;
    const r = role();
    const frag = document.createDocumentFragment();

    frag.appendChild(songKeysBlock());
    frag.appendChild(noteBlock(null));

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
    state.groups.forEach((g) => {
      if (g.empty) return;   // its chip in the song order says how many bars to wait
      const occ = g.occ.map((i) => state.parts[i]);
      // in landscape or upright, a part with almost nothing to play (mostly rests, or no tab for this instrument)
      // gets no card of its own: fewer than a quarter of its bars have notes. Its chip stays in the song order.
      if (isPaged() || isCompact()) {
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
      card.appendChild(sectionBlock(occ[0]));
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
  function sectionBlock(p) {
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
    if (showTabInCards()) {
      const holder = document.createElement('div');
      holder.className = 'mini-tab';
      holder.dataset.start = p.start;
      holder.dataset.len = p.bars;
      div.appendChild(holder);
    }
    return div;
  }

  function riffBlock(riff, seenBefore) {
    const div = document.createElement('div');
    div.className = 'riff' + (seenBefore ? ' seen' : '');
    const firstPart = state.parts[partIndexForBar(riff.start)];
    const chordCells = [];
    for (let k = 0; k < riff.len; k++) {
      const names = chordsAt(riff.start + k);
      chordCells.push(`<button class="chord-cell" data-bar="${riff.start + k}" data-riff="${riff.id}" data-offset="${k}" title="Change the chords for bar ${k + 1} of riff ${riff.id}">${names.length ? names.map(esc).join(' ') : '<span class="no-chord">+ chord</span>'}</button>`);
    }
    div.innerHTML = `
      <div class="riff-head">
        <span class="riff-id">${esc(riff.id)}</span>
        <span class="riff-len">${plural(riff.len, 'bar')}${riff.uses > 1 ? ` · played ${riff.uses} times in the song` : ''}</span>
        <button class="riff-play" type="button" aria-label="Play riff ${esc(riff.id)}" title="Loop this riff">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>
        </button>
      </div>
      ${showChords() ? `<div class="chord-row">${chordCells.join('<span class="bar-sep">|</span>')}</div>` : ''}
      ${seenBefore ? `<p class="seen-note">Same riff as in ${esc(firstPart ? firstPart.label : 'an earlier section')}.</p>` : ''}`;
    div.querySelectorAll('.chord-cell').forEach((b) => b.addEventListener('click', () => openChordDialog(Number(b.dataset.bar), b.dataset.riff, Number(b.dataset.offset))));
    div.querySelector('.riff-play').addEventListener('click', () => playRange(riff.start, riff.start + riff.len - 1));
    // one part per screen in landscape, so a riff is drawn on every card that uses it
    if ((!seenBefore || isPaged()) && showTabInCards() && !riff.empty) {
      const holder = document.createElement('div');
      holder.className = 'mini-tab';
      holder.dataset.start = riff.start;
      holder.dataset.len = riff.len;
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

  // Small tab snippets are drawn only when they scroll into view.
  // As many bars to a row as fit (about 140px a bar at normal size), keeping to 1, 2, 4 or 8 so phrases stay together:
  // 2 on a phone, 8 on a wide screen.
  // Each note needs at least this much width on screen (CSS px, before the tab size), so a dense bar is never squeezed.
  const MIN_PX_PER_NOTE = 22;
  // How many bars fit on one line of a tab. A bar is never narrower than MIN_PX_PER_NOTE for each of its notes,
  // so a dense section (a bass solo) wraps onto more lines instead of cramming its notes together.
  function barsPerRow(width, len, start) {
    let most = 0;
    if (start != null && state.score) {
      for (let k = 0; k < len; k++) most = Math.max(most, SM.analysis.barTokens(state.score, state.trackIndex, start + k).length);
    }
    const base = isPaged() ? 90 : isCompact() ? 82 : 140;
    const barWidth = Math.max(base, most * MIN_PX_PER_NOTE) * prefs.zoom;
    const fit = Math.max(1, Math.floor(width / barWidth));
    const n = [8, 4, 2, 1].find((x) => x <= fit);
    return Math.min(len, n);
  }
  // A phone on its side: one screen per part (two when they fit), swiped or picked from the song order.
  // A tablet held upright: the cards are trimmed so several parts fit on one screen without scrolling.
  // Every window except a landscape phone (which has its own one-screen layout) gets the compact cards,
  // with the Cards / Full tab switch in the title bar, so phones, tablets and desktops look the same.
  const landscapeQuery = window.matchMedia('(orientation: landscape) and (max-height: 540px)');
  const isCompact = () => document.body.classList.contains('compact');
  const compactClass = () => { const on = !landscapeQuery.matches && !!state.score; if (on !== isCompact()) { document.body.classList.toggle('compact', on); return true; } return false; };
  const syncUpright = () => document.body.classList.toggle('upright', !landscapeQuery.matches);
  syncUpright();
  compactClass();
  const isPaged = () => document.body.classList.contains('paged');
  function applyPaged() {
    const paged = landscapeQuery.matches && prefs.view === 'cards' && !els.songView.hidden && !role().cues && !!state.score && state.song && state.song.hasTab !== false;
    if (paged === isPaged()) return false;
    document.body.classList.toggle('paged', paged);
    return true;
  }
  const relayout = () => {
    applyPaged();
    const changed = compactClass();
    syncUpright();
    if ((changed || isPaged()) && state.score && prefs.view === 'cards') renderCards();
  };
  if (landscapeQuery.addEventListener) landscapeQuery.addEventListener('change', relayout);
  // the song order lights up the parts on screen
  function markInView() {
    if (!isPaged()) return;
    const box = els.cards.getBoundingClientRect();
    const keys = new Set([...els.cards.querySelectorAll('.card')].filter((c) => {
      const r = c.getBoundingClientRect();
      return r.left < box.right - 20 && r.right > box.left + 20;
    }).map((c) => c.dataset.group));
    els.structure.querySelectorAll('.step').forEach((t) => t.classList.toggle('in-view', keys.has(t.dataset.group)));
  }
  // the part picked from the song order, until the person swipes somewhere else themselves
  let pagedTarget = null;
  ['touchstart', 'wheel', 'mousedown'].forEach((ev) => els.cards.addEventListener(ev, () => { pagedTarget = null; }, { passive: true }));
  els.cards.addEventListener('scroll', () => { clearTimeout(markInView.t); markInView.t = setTimeout(markInView, 80); }, { passive: true });

  // Snippets are laid out for the width they had, so redraw the cards when a resize changes how many bars fit.
  let lastFit = null;
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!state.score || prefs.view !== 'cards' || els.songView.hidden) return;
      const fit = barsPerRow(els.cards.clientWidth, 8, null);
      if (lastFit !== null && fit !== lastFit) { const top = els.scroller.scrollTop; renderCards(); els.scroller.scrollTop = top; }
      lastFit = fit;
    }, 250);
  });

  function startMinis() {
    lastFit = barsPerRow(els.cards.clientWidth, 8, null);
    const holders = [...els.cards.querySelectorAll('.mini-tab')];
    if (!holders.length) return;
    // A part's tab is drawn while it is near the screen and released when it scrolls away, so a long song never
    // holds every drawing in memory (an older iPad runs out of memory and crashes with them all open).
    const draw = (el) => {
      if (el.dataset.drawn) return;
      el.dataset.drawn = '1';
      const mini = new AT.AlphaTabApi(el, {
        core: { fontDirectory: 'lib/font/', engine: 'svg', logLevel: 'error', useWorkers: false, enableLazyLoading: false },
        display: {
          scale: prefs.zoom * (isPaged() ? 0.72 : isCompact() ? 0.7 : 0.85), layoutMode: AT.LayoutMode.Page, staveProfile: STAVES[prefs.stave] ?? AT.StaveProfile.Tab,
          startBar: Number(el.dataset.start) + 1, barCount: Number(el.dataset.len),
          barsPerRow: barsPerRow(el.clientWidth || els.cards.clientWidth, Number(el.dataset.len), Number(el.dataset.start)),
          // a phrase of 8 or more bars that fills its rows is stretched across the card; a short riff keeps its natural width,
          // so three bars are not stretched into the width of eight
          justifyLastSystem: Number(el.dataset.len) >= 8 && Number(el.dataset.len) % barsPerRow(el.clientWidth || els.cards.clientWidth, Number(el.dataset.len), Number(el.dataset.start)) === 0
        },
        notation: { rhythmMode: AT.TabRhythmMode.ShowWithBars },
        player: { playerMode: AT.PlayerMode.Disabled }
      });
      [AT.NotationElement.ScoreTitle, AT.NotationElement.ScoreSubTitle, AT.NotationElement.ScoreArtist, AT.NotationElement.ScoreAlbum,
        AT.NotationElement.ScoreWords, AT.NotationElement.ScoreMusic, AT.NotationElement.ScoreWordsAndMusic, AT.NotationElement.ScoreCopyright,
        AT.NotationElement.TrackNames, AT.NotationElement.GuitarTuning, AT.NotationElement.EffectMarker, AT.NotationElement.EffectText,
        AT.NotationElement.EffectChordNames, AT.NotationElement.EffectTempo].forEach((e) => mini.settings.notation.elements.set(e, false));
      styleTab(mini);
      mini.updateSettings();
      // alphaTab adds a "rendered by alphaTab" line to every render; the full tab keeps it, snippets drop it.
      mini.renderFinished.on(() => {
        diag.miniDone();
        el.style.minHeight = '';
        // the card is its full height now, which can move the parts after it on to the next screen;
        // a part just picked from the song order is kept in view
        const picked = pagedTarget && isPaged() && els.cards.querySelector(`.card[data-group="${CSS.escape(pagedTarget)}"]`);
        if (picked) els.cards.scrollLeft = picked.offsetLeft - els.cards.offsetLeft;
        clearTimeout(markInView.t);
        markInView.t = setTimeout(markInView, 80);
        el.querySelectorAll('svg').forEach((svg) => { if (svg.querySelectorAll('text').length === 1 && /alphaTab/.test(svg.textContent)) svg.parentElement.style.display = 'none'; });
      });
      mini.renderScore(state.score, [state.trackIndex]);
      el._mini = mini;
      minis.push(mini);
      diag.miniDrawn();
    };
    const release = (el) => {
      if (!el.dataset.drawn) return;
      // keep the height, so the card below does not jump when this one is released
      if (el.offsetHeight) el.style.minHeight = `${el.offsetHeight}px`;
      const mini = el._mini;
      if (mini) {
        try { mini.destroy(); } catch (e) { /* already gone */ }
        minis = minis.filter((m) => m !== mini);
      }
      el._mini = null;
      el.innerHTML = '';
      delete el.dataset.drawn;
    };
    if ('IntersectionObserver' in window) {
      miniObserver = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) draw(en.target); else release(en.target); }),
        isPaged() ? { root: els.cards, rootMargin: '0px 100% 0px 100%' } : { root: els.scroller, rootMargin: '300px' });
      holders.forEach((h) => miniObserver.observe(h));
    } else {
      holders.forEach(draw);
    }
  }

  /* ---------------- views ---------------- */
  function setView(v) {
    if (v === prefs.view) return;
    prefs.view = v;
    savePrefs();
    applyViewChrome();
    if (v === 'tab') {
      destroyMinis();
      els.cards.innerHTML = '';
      api.render();
    } else {
      renderCards();
      els.scroller.scrollTop = 0;
    }
    refreshChipStates();
  }

  function applyViewChrome() {
    applyPaged();
    const cards = prefs.view === 'cards';
    [[els.viewCards, els.viewCardsTop, cards], [els.viewTab, els.viewTabTop, !cards]].forEach(([a, b, on]) => {
      a.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-pressed', String(on));
    });
    els.cards.hidden = !cards;
    els.tab.hidden = cards;
    els.sectionHead.hidden = cards;
    if (cards && state.editing) setEditing(false);
  }

  function selectView(index, opts = {}) {
    if (!state.score) return;
    index = Math.max(-1, Math.min(state.parts.length - 1, index));
    state.view = index;
    refreshChipStates();
    updateHeader();
    const d = api.settings.display;
    if (index === -1) { d.startBar = 1; d.barCount = -1; } else { d.startBar = state.parts[index].start + 1; d.barCount = state.parts[index].bars; }
    api.updateSettings();
    api.render();
    els.scroller.scrollTop = 0;
    applyPlaybackRange();
    if (!opts.keepVideo) seekVideoToView();
    const active = els.structure.querySelector('[aria-current="true"]');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // Playback counts ticks in the order bars are played, so bars after a repeat start later than written.
  function rangeFor(start, end) {
    const mbs = state.score.masterBars;
    const at = (bar) => (state.firstTick && state.firstTick[bar] != null ? state.firstTick[bar] : mbs[bar].start);
    const range = new AT.synth.PlaybackRange();
    range.startTick = at(start);
    range.endTick = at(end) + mbs[end].calculateDuration();
    return range;
  }

  function applyPlaybackRange() {
    if (!state.score) return;
    if (state.view === -1) { api.playbackRange = null; api.isLooping = false; return; }
    const p = state.parts[state.view];
    const range = new AT.synth.PlaybackRange();
    range.startTick = p.playStart;
    range.endTick = p.playEnd;
    api.playbackRange = range;
    api.isLooping = state.loop;
    api.tickPosition = range.startTick;
  }

  function playRange(start, end) {
    if (els.playBtn.disabled) { toast(soundProblem || 'Sounds are still loading'); return; }
    const range = rangeFor(start, end);
    api.stop();
    api.playbackRange = range;
    api.isLooping = state.loop;
    api.tickPosition = range.startTick;
    api.play();
  }

  /* ---------------- alphaTab ---------------- */
  const api = new AT.AlphaTabApi(els.tab, {
    core: { fontDirectory: 'lib/font/', engine: 'svg', logLevel: 'warning' },
    display: { scale: prefs.zoom, layoutMode: AT.LayoutMode.Page, staveProfile: STAVES[prefs.stave] ?? AT.StaveProfile.Tab },
    notation: { rhythmMode: AT.TabRhythmMode.ShowWithBars },
    player: {
      playerMode: AT.PlayerMode.EnabledSynthesizer,
      soundFont: 'lib/soundfont/sonivox.sf2',
      scrollElement: els.scroller,
      enableCursor: true,
      enableUserInteraction: true,
      scrollOffsetY: -30
    }
  });
  [AT.NotationElement.ScoreTitle, AT.NotationElement.ScoreSubTitle, AT.NotationElement.ScoreArtist,
    AT.NotationElement.ScoreAlbum, AT.NotationElement.ScoreWords, AT.NotationElement.ScoreMusic,
    AT.NotationElement.ScoreWordsAndMusic, AT.NotationElement.ScoreCopyright, AT.NotationElement.TrackNames].forEach((e) => {
    api.settings.notation.elements.set(e, false);
  });

  // Theme colours, bigger bold fret numbers and wider string spacing than alphaTab's defaults (14px on 13px).
  // Each tab number gets a solid box in the page colour just under it, so the lines behind it are cut away.
  // A plain box rather than an outline, which older browsers draw badly on SVG text. Boxes are drawn only once the
  // number has a size, so numbers drawn while the tab is hidden get theirs when it is shown.
  function addNumberHalos(root) {
    const ns = 'http://www.w3.org/2000/svg';
    root.querySelectorAll('svg text').forEach((t) => {
      if (t.dataset.halo || t.classList.contains('tab-halo') || !t.parentNode || !t.getBBox) return;
      let box;
      try { box = t.getBBox(); } catch (e) { return; }
      if (!box || box.width === 0) return;
      // fret numbers only: digits at the size of the tab, not rests, the time signature or bar numbers
      if (!/^\d{1,2}$/.test(t.textContent.trim()) || box.height < 14 || box.height > 30) return;
      const pad = 3;
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('class', 'tab-halo');
      rect.setAttribute('x', box.x - pad);
      rect.setAttribute('y', box.y + box.height * 0.12);
      rect.setAttribute('width', box.width + pad * 2);
      rect.setAttribute('height', box.height * 0.76);
      rect.setAttribute('rx', 3);
      t.dataset.halo = '1';
      t.parentNode.insertBefore(rect, t);
    });
  }

  function styleTab(target) {
    const cs = getComputedStyle(document.documentElement);
    const v = (name) => cs.getPropertyValue(name).trim();
    const r = target.settings.display.resources;
    r.mainGlyphColor = hexToColor(v('--ink'));
    r.secondaryGlyphColor = hexToColor(v('--muted'));
    r.scoreInfoColor = hexToColor(v('--ink'));
    r.barNumberColor = hexToColor(v('--muted'));
    r.barSeparatorColor = hexToColor(v('--muted'));
    // solid lines, a light blend of the muted colour into the surface: a translucent colour did not lighten them
    const line = hexToColor(v('--muted'));
    const paper = hexToColor(v('--surface'));
    const blend = (a, b) => Math.round(a + (b - a) * 0.6);
    r.staffLineColor = new AT.model.Color(blend(line.r, paper.r), blend(line.g, paper.g), blend(line.b, paper.b), 255);
    r.tablatureFont = new AT.model.Font('Arial, Helvetica, sans-serif', 19, AT.model.FontStyle.Plain, AT.model.FontWeight.Bold);
    r.engravingSettings.tabLineSpacing = 18;
  }
  styleTab(api);
  api.updateSettings();

  const themeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const onTheme = () => {
    styleTab(api);
    api.updateSettings();
    if (state.score) { if (prefs.view === 'tab') api.render(); else renderCards(); }
  };
  if (themeQuery.addEventListener) themeQuery.addEventListener('change', onTheme);
  new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  api.scoreLoaded.on((score) => {
    diag.mark('parsed');
    state.score = score;
    original.text.clear();
    original.chord.clear();
    // details are read from the tab as written, then it is moved to the key chosen for the band or this device
    state.tabMeta = SM.analysis.songMeta(score);
    const moved = SM.analysis.transposeScore(score, transposeSemis(), SM.chords.transposeName);
    if (moved.octaveMoved) toast(`${plural(moved.octaveMoved, 'note')} would be below the lowest string, so they were moved up an octave`);
    state.fileMarkers = markersFromScore(score);
    state.fileChords = SM.analysis.fileChords(score);
    state.trackIndex = pickTrack(score);
    updateBanner();
    let suggested = false;
    if (!Array.isArray(state.notes.sections)) {
      // Worked out fresh each time until someone edits them, so nothing is saved yet.
      if (state.fileMarkers.length) {
        state.notes.sections = state.fileMarkers.map((m) => ({ ...m }));
      } else {
        state.notes.sections = SM.analysis.suggestSections(score, state.trackIndex, (i) => (state.fileChords[i] || []).map((c) => c.name)).map((s) => ({ id: uid(), ...s }));
        suggested = state.notes.sections.length > 1;
      }
    }
    deriveParts();
    diag.mark('sections and analysis');
    applyAnnotations();
    // key, tempo and length are kept with the song so the song list can show them without opening it
    const meta = state.tabMeta;
    if (state.song.canShare && JSON.stringify(meta) !== JSON.stringify(state.notes.meta)) {
      state.notes.meta = meta;
      saveNotes();
    }
    updateSongMeta();
    state.view = -1;
    renderMap();
    fillTrackSelect();
    applyPlaybackRange();
    if (prefs.view === 'cards') { renderCards(); doneSwitching(); diag.mark('cards shown'); }
    if (suggested) toast(`This file had no sections, so Setcards suggested ${state.notes.sections.length}. Rename them in Edit.`);
  });

  api.renderStarted.on(() => { els.loading.hidden = false; });
  api.renderFinished.on(() => { els.loading.hidden = true; doneSwitching(); });
  // alphaTab draws its tab into the page after it reports a render, so the numbers are marked as they appear
  [els.tab, els.cards].forEach((box) => new MutationObserver(() => addNumberHalos(box)).observe(box, { childList: true, subtree: true }));
  api.error.on((e) => {
    els.loading.hidden = true;
    console.error(e);
    toast('That file could not be read. Try exporting it again from Guitar Pro.');
  });
  // Why sound is not available is shown, so a missing synthesizer does not fail silently.
  let soundProblem = (window.AudioContext || window.webkitAudioContext) ? null : 'This browser has no audio support, so there is no playback.';
  const reportSound = (reason) => {
    soundProblem = reason;
    console.warn('Setcards sound:', reason);
    els.playerStatus.textContent = reason;
  };
  if (soundProblem) reportSound(soundProblem);
  api.soundFontLoad.on((e) => {
    if (e.total) els.playerStatus.textContent = `Loading sounds ${Math.round((e.loaded / e.total) * 100)}%`;
  });
  // alphaTab does not report a failed sound load to the page, so a long wait is named instead
  let soundReady = false;
  setTimeout(() => { if (!soundReady && !soundProblem) reportSound('The sounds have not loaded after 20 seconds, so playback may be off on this device.'); }, 20000);
  api.playerReady.on(() => {
    soundReady = true;
    soundProblem = null;
    els.playBtn.disabled = false;
    els.playerStatus.textContent = '';
  });
  api.playerStateChanged.on((e) => {
    state.playing = e.state === 1;
    els.playBtn.classList.toggle('is-playing', state.playing);
    els.playBtn.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
    if (!state.playing && !(ytPlayer && ytReady)) setPlayingPart(-1);
  });
  api.playerPositionChanged.on((e) => {
    if (!state.score || !state.playing) return;
    setPlayingPart(partIndexForTick(e.currentTick));
  });
  function setPlayingPart(i) {
    if (i === state.playingPart) return;
    state.playingPart = i;
    refreshChipStates();
  }

  // In edit mode a tap on a bar opens the section and chord dialog for that bar.
  els.tab.addEventListener('click', (e) => {
    if (!state.editing || !api.boundsLookup) return;
    const surface = els.tab.querySelector('.at-surface');
    if (!surface) return;
    const r = surface.getBoundingClientRect();
    const beat = api.boundsLookup.getBeatAtPos(e.clientX - r.left, e.clientY - r.top);
    if (beat) openBarDialog(beat.voice.bar.index);
  });

  /* ---------------- tracks and roles ---------------- */
  function trackMatches(t, roleId) {
    const st = t.staves[0];
    const name = (t.name || '').toLowerCase();
    const prog = t.playbackInfo.program;
    if (roleId === 'drums') return !!(st && st.isPercussion) || /drum|perc/.test(name);
    if (st && st.isPercussion) return false;
    if (roleId === 'bass') return /bass/.test(name) || (prog >= 32 && prog <= 39);
    if (roleId === 'guitar') return (/guit|gtr/.test(name) && !/bass/.test(name)) || (prog >= 24 && prog <= 31);
    if (roleId === 'keys') return /key|piano|organ|synth|rhodes|wurli/.test(name) || prog <= 23;
    if (roleId === 'vocals') return /voc|vox|voice|sing|lead/.test(name) || (prog >= 52 && prog <= 54);
    return false;
  }
  function pickTrack(score) {
    const chosen = prefs.tracks[state.song.key] && prefs.tracks[state.song.key][prefs.role];
    state.partMissing = false;
    if (chosen != null && score.tracks[chosen]) return chosen;
    // a file can hold a notation copy and a tab copy of the same part; string players get the tab
    const matches = score.tracks.map((t, k) => k).filter((k) => trackMatches(score.tracks[k], prefs.role));
    const withTab = matches.find((k) => score.tracks[k].staves.some((st) => st.showTablature));
    if (matches.length) return ['bass', 'guitar'].includes(prefs.role) && withTab != null ? withTab : matches[0];
    // vocals and keys players often read another part; a missing bass, guitar or drum part is worth saying
    state.partMissing = ['bass', 'guitar', 'drums'].includes(prefs.role);
    const bass = score.tracks.findIndex((t) => trackMatches(t, 'bass'));
    return bass >= 0 ? bass : 0;
  }
  function useTrack(i) {
    state.trackIndex = i;
    deriveParts();
    applyAnnotations();
    renderMap();
    api.renderTracks([state.score.tracks[i]]);
    if (prefs.view === 'cards') renderCards();
    els.trackSel.value = i;
  }

  function setRole(id) {
    prefs.role = id;
    prefs.roleChosen = true;
    savePrefs();
    els.roleBtn.textContent = role().label;
    els.homeRoleBtn.textContent = role().label;
    if (!state.score) return;
    const i = pickTrack(state.score);
    updateBanner();
    if (i !== state.trackIndex) useTrack(i);
    else if (prefs.view === 'cards') renderCards();
    els.showTabCards.checked = showTabInCards();
    els.showChords.checked = showChords();
    if (applyChordVisibility() && prefs.view === 'tab') api.render();
  }

  const openRoles = () => {
    els.roleList.innerHTML = '';
    ROLES.forEach((r) => {
      const b = document.createElement('button');
      b.className = 'role-opt';
      b.setAttribute('aria-pressed', String(r.id === prefs.role));
      b.textContent = r.label;
      b.addEventListener('click', () => { closeDialog(els.roleDlg); setRole(r.id); });
      els.roleList.appendChild(b);
    });
    els.roleDlg.showModal();
  };
  els.roleBtn.addEventListener('click', openRoles);
  els.homeRoleBtn.addEventListener('click', openRoles);
  els.syncBtn.addEventListener('click', () => { if (!syncTasks.has('songs')) renderHome(); });

  /* ---------------- loading songs ---------------- */
  function resetDisplay() {
    const d = api.settings.display;
    d.startBar = 1;
    d.barCount = -1;
    d.scale = prefs.zoom;
    d.staveProfile = STAVES[prefs.stave] ?? AT.StaveProfile.Tab;
    api.updateSettings();
  }

  // While another song is on its way, the last one is hidden rather than left on screen.
  function startSwitching(title) {
    pagedTarget = null;
    els.cards.scrollLeft = 0;
    if (state.playing) api.stop();
    destroyMinis();
    els.cards.innerHTML = '';
    els.structure.innerHTML = '';
    els.songView.classList.add('switching');
    els.songTitle.textContent = title || '';
    els.songMeta.textContent = '';
    els.banner.hidden = true;
    els.loading.hidden = false;
  }
  const doneSwitching = () => els.songView.classList.remove('switching');

  let opening = null;
  async function openSong(key, title) {
    flushSave();
    opening = key;
    diag.start();
    startSwitching(title);
    let song;
    try {
      song = await SM.library.open(key);
    } catch (e) {
      console.error(e);
      els.loading.hidden = true;
      doneSwitching();
      toast(e.message || 'That song could not be opened');
      return false;
    }
    diag.mark('copy read');
    if (opening !== key) return true;   // another song was picked meanwhile
    applySong(key, song);
    if (song.latest) checkForChanges(key, song);
    return true;
  }

  // The saved copy is on screen; if the band folder has something newer, show that instead.
  function checkForChanges(key, song) {
    // song details worked out from the tab (meta) are refreshed on every open, so they don't count as an edit
    const edits = () => JSON.stringify({ ...state.notes, meta: null, updatedAt: null });
    const shown = edits();
    song.latest().then((fresh) => {
      if (!fresh || !state.song || state.song.key !== key) return;
      // changes made here in the meantime are being saved, and win
      if (edits() !== shown) return;
      const top = els.scroller.scrollTop;
      applySong(key, fresh, true);
      setTimeout(() => { els.scroller.scrollTop = top; }, 300);
      toast('Updated with the band’s latest changes');
    }).catch(() => {
      if (!state.song || state.song.key !== key) return;
      state.song.offline = true;
      updateBanner();
    });
  }

  function applySong(key, song, refresh) {
    const prevVideo = state.notes && state.notes.youtubeUrl;
    if (state.playing) api.stop();
    destroyMinis();
    state.song = { key, title: song.notes.title || song.title || (song.fileName || 'Untitled').replace(SM.SONG_EXT, ''), artist: song.notes.artist || song.artist || '', fileName: song.fileName, canShare: song.canShare, localOnly: song.localOnly, offline: !!song.offline };
    state.notes = song.notes;
    state.notes.chords = state.notes.chords || {};
    // changes kept in this browser while the page was closing are sent on to where the song lives
    if (song.fromOverlay && song.canShare) saveNotes();
    state.score = null;
    state.playingPart = -1;
    prefs.last = key;
    savePrefs();
    els.songTitle.textContent = state.song.title;
    updateSongMeta();
    document.title = `${state.song.title} · Setcards`;
    updateBanner();
    resetDisplay();
    if (state.editing) setEditing(false);
    // a song's video is not shown until it is asked for
    if (!refresh) state.videoOn = false;
    if (!refresh || song.notes.youtubeUrl !== prevVideo) setupVideo();
    const hasTab = !!(song.bytes || song.tex);
    state.song.hasTab = hasTab;
    document.body.classList.toggle('no-tab', !hasTab);
    els.noTab.hidden = hasTab;
    if (!hasTab) {
      // A song added before anyone found its tab: show what is known, and a way to attach the file.
      state.parts = [];
      state.groups = [];
      els.loading.hidden = true;
      renderNoTab();
      doneSwitching();
      return;
    }
    // All tracks are loaded; the one for this person's role is chosen once the file is read.
    state.source = { bytes: song.bytes, tex: song.tex };
    loadSource();
  }

  // Reads the tab again from the copy already downloaded, for example after a change of transposition.
  function loadSource() {
    const key = state.song.key;
    const track = (prefs.tracks[key] && prefs.tracks[key][prefs.role]) || 0;
    if (state.source.tex) api.tex(state.source.tex, [track]);
    else api.load(state.source.bytes, [track]);
  }

  function setTranspose(band, mine) {
    const before = transposeSemis();
    if (band !== undefined) { state.notes.transpose = band || undefined; if (!band) delete state.notes.transpose; saveNotes(); }
    if (mine !== undefined) {
      if (mine === null) delete prefs.transpose[state.song.key]; else prefs.transpose[state.song.key] = mine;
      savePrefs();
    }
    fillKeySettings();
    updateSongMeta();
    if (transposeSemis() !== before && state.song.hasTab) {
      flushSave();
      loadSource();
      toast(transposeSemis() ? `Tab shown ${signed(transposeSemis())}` : 'Tab shown as written');
    }
  }

  function searchLinks() {
    const q = [state.song.title, state.song.artist].filter(Boolean).join(' ');
    return {
      songsterr: `https://www.songsterr.com/?pattern=${encodeURIComponent(q)}`,
      ug: `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(q)}`
    };
  }

  function renderNoTab() {
    const box = els.noTab;
    const links = searchLinks();
    const status = songStatus(state.notes, false);
    box.innerHTML = `
      <label class="field status-field"><span>Status</span>
        <select id="noTabStatus">${Object.keys(STATUS_LABELS).map((k) => `<option value="${k}"${k === status ? ' selected' : ''}>${STATUS_LABELS[k]}</option>`).join('')}</select>
      </label>
      <div class="no-tab-main">
        <h2>No tab yet</h2>
        <p class="fine">When someone finds a Guitar Pro file for this song, add it here. Everything already noted for the song is kept.</p>
        <label class="file-btn"><input id="attachInput" type="file"> Add the Guitar Pro file</label>
        <p class="fine">Look for one on <a href="${links.songsterr}" target="_blank" rel="noopener">Songsterr</a> or <a href="${links.ug}" target="_blank" rel="noopener">Ultimate Guitar</a>.</p>
      </div>
      <label class="field"><span>YouTube link</span><input id="noTabYt" type="url" inputmode="url" placeholder="https://www.youtube.com/watch?v=…"></label>`;
    box.querySelector('#noTabYt').value = state.notes.youtubeUrl || '';
    box.querySelector('#noTabStatus').addEventListener('change', (e) => { setStatus(e.target.value); });
    box.querySelector('#noTabYt').addEventListener('change', (e) => {
      const v = e.target.value.trim();
      if (v && !youtubeId(v)) { toast('That does not look like a YouTube link'); return; }
      state.notes.youtubeUrl = v;
      saveNotes();
      setupVideo();
    });
    box.querySelector('#attachInput').addEventListener('change', (e) => attachTab(e.target.files[0]));
    box.appendChild(noteBlock(null));
  }

  function setStatus(value) {
    state.notes.status = value;
    saveNotes();
    updateSongMeta();
  }

  // Attaches a Guitar Pro file to a song that didn't have one, keeping its notes, status and video.
  async function attachTab(file) {
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const score = AT.importer.ScoreLoader.loadScoreFromBytes(bytes, api.settings);
      const { source, sourceId, id } = SM.library.parse(state.song.key);
      await flushSave();
      const notes = Object.assign({}, state.notes, { meta: SM.analysis.songMeta(score), updatedAt: Date.now() });
      if (!notes.artist && score.artist) notes.artist = score.artist;
      toast('Adding the tab…');
      const newId = await source.attachTab(id, file.name, bytes, notes);
      await openSong(SM.library.key(sourceId, newId));
      toast('Tab added. Setcards has worked out its sections.');
    } catch (e) {
      console.error(e);
      toast(e.message && /Google|Drive/.test(e.message) ? e.message : 'That file could not be read. Setcards opens Guitar Pro 3 to 8 files and MusicXML.');
    }
  }

  // alphaTab renders the track passed to load(); switch to the role's track once the score is known.
  api.scoreLoaded.on((score) => {
    if (api.tracks && api.tracks.length && api.tracks[0] !== score.tracks[state.trackIndex]) {
      setTimeout(() => api.renderTracks([score.tracks[state.trackIndex]]), 0);
    }
  });

  async function importFile(file) {
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const score = AT.importer.ScoreLoader.loadScoreFromBytes(bytes, api.settings);
      const meta = { title: score.title || file.name.replace(/\.[^.]+$/, ''), artist: score.artist || '' };
      const notes = SM.library.emptyNotes(meta);
      notes.meta = SM.analysis.songMeta(score);
      notes.status = 'learning';
      closeDialog(els.addDlg);
      const toBand = inBand() && drive.connected() && drive.signedIn() && els.shareUpload.checked;
      const source = toBand ? drive : SM.library.sources.local;
      toast(toBand ? 'Adding to the band folder…' : (inBand() ? 'Adding to your drafts…' : 'Adding to this device…'));
      const id = await source.add(file.name, bytes, notes, meta);
      await openFromList(SM.library.key(source.id, id));
      toast(toBand ? 'Added to the band folder' : (inBand() ? 'Added to your drafts. Share it with the band from the song list.' : 'Added to this device'));
    } catch (e) {
      console.error(e);
      toast(e.message && /Google|Drive/.test(e.message) ? e.message : 'That file could not be read. Setcards opens Guitar Pro 3 to 8 files and MusicXML.');
    }
  }

  async function addDemo() {
    const local = SM.library.sources.local;
    const songs = await local.list();
    const demo = songs.find((s) => s.isDemo);
    if (demo) return SM.library.key('local', demo.id);
    const meta = { title: window.DEMO_SONG.title, artist: window.DEMO_SONG.artist, tex: window.DEMO_SONG.tex, isDemo: true };
    const id = await local.add('demo.tex', null, SM.library.emptyNotes(meta), meta);
    return SM.library.key('local', id);
  }

  /* ---------------- edit mode ---------------- */
  function setEditing(on) {
    state.editing = on;
    document.body.classList.toggle('editing', on);
    els.editBtn.setAttribute('aria-pressed', String(on));
    els.editBtn.textContent = on ? 'Done' : 'Edit';
    els.editPanel.hidden = !on;
    if (on) {
      if (prefs.view !== 'tab') setView('tab');
      renderEditList();
      if (state.view !== -1) selectView(-1);
    }
  }

  function sectionsChanged() {
    const prevView = state.view;
    deriveParts();
    applyAnnotations();
    state.view = Math.min(prevView, state.parts.length - 1);
    renderMap();
    renderEditList();
    saveNotes();
    if (prefs.view === 'tab') selectView(state.view, { keepVideo: true }); else renderCards();
  }

  function chordsChanged() {
    applyAnnotations();
    saveNotes();
    if (prefs.view === 'tab') api.render(); else renderCards();
  }

  const trashIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M7 7l1 12h8l1-12M9 7V4h6v3"/></svg>';

  function renderEditList() {
    if (!state.editing || !state.score) return;
    const list = sortedSections();
    const n = state.score.masterBars.length;
    els.sectionList.innerHTML = '';
    if (!list.length) {
      const li = document.createElement('li');
      li.className = 'fine';
      li.textContent = 'No sections yet.';
      els.sectionList.appendChild(li);
    }
    const videoReady = !!(ytPlayer && ytReady);
    list.forEach((s) => {
      const p = state.parts.find((x) => x.ref === s);
      const li = document.createElement('li');
      li.className = 'section-row';
      li.style.setProperty('--seg', segColor(kindOf(s.name)));
      li.innerHTML = `
        <span class="swatch"></span>
        <input class="name-in" list="nameList" aria-label="Section name">
        <label class="bar-label">Bar <input class="bar-in" type="number" min="1" max="${n}" inputmode="numeric" aria-label="Start bar"></label>
        <label class="unit-label">Repeats every
          <select class="unit-in" aria-label="Bars per repeat">
            <option value="">auto (${p ? p.unit : '?'})</option><option value="1">1 bar</option><option value="2">2 bars</option><option value="4">4 bars</option><option value="8">8 bars</option><option value="999">no repeat</option>
          </select>
        </label>
        <div class="time-wrap">
          <label>Video <input class="time-in" placeholder="m:ss" inputmode="numeric" aria-label="Video start time"></label>
          ${videoReady ? '<button class="mini now-btn" type="button">Now</button>' : ''}
        </div>
        <button class="del" type="button" aria-label="Remove section">${trashIcon}</button>`;
      const nameIn = li.querySelector('.name-in');
      const barIn = li.querySelector('.bar-in');
      const unitIn = li.querySelector('.unit-in');
      const timeIn = li.querySelector('.time-in');
      nameIn.value = s.name;
      barIn.value = s.start + 1;
      unitIn.value = s.unit ? String(s.unit) : '';
      timeIn.value = fmtTime(s.videoTime);
      nameIn.addEventListener('change', () => {
        const next = nameIn.value.trim() || 'Section';
        const oldBase = baseName(s.name).toLowerCase();
        // Renaming "Part A" renames every section with that name, since they are the same part.
        const same = state.notes.sections.filter((o) => baseName(o.name).toLowerCase() === oldBase);
        same.forEach((o) => { o.name = next; });
        if (same.length > 1) toast(`Renamed all ${same.length} “${baseName(next)}” sections`);
        sectionsChanged();
      });
      barIn.addEventListener('change', () => {
        const v = Math.round(Number(barIn.value)) - 1;
        if (isNaN(v) || v < 0 || v >= n) { toast(`Pick a bar between 1 and ${n}`); barIn.value = s.start + 1; return; }
        if (state.notes.sections.some((o) => o !== s && o.start === v)) { toast(`Another section already starts at bar ${v + 1}`); barIn.value = s.start + 1; return; }
        s.start = v;
        sectionsChanged();
      });
      unitIn.addEventListener('change', () => {
        s.unit = unitIn.value ? Number(unitIn.value) : undefined;
        sectionsChanged();
      });
      timeIn.addEventListener('change', () => {
        const t = parseTime(timeIn.value);
        if (t === undefined) { toast('Use minutes:seconds, for example 1:05'); timeIn.value = fmtTime(s.videoTime); return; }
        s.videoTime = t;
        saveNotes();
      });
      const nowBtn = li.querySelector('.now-btn');
      if (nowBtn) {
        nowBtn.addEventListener('click', () => {
          s.videoTime = Math.round(ytPlayer.getCurrentTime() * 10) / 10;
          timeIn.value = fmtTime(s.videoTime);
          saveNotes();
        });
      }
      li.querySelector('.del').addEventListener('click', () => {
        state.notes.sections = state.notes.sections.filter((o) => o !== s);
        sectionsChanged();
      });
      els.sectionList.appendChild(li);
    });
  }

  function openBarDialog(bar) {
    state.barDlgIndex = bar;
    const existing = state.notes.sections.find((s) => s.start === bar);
    els.barDlgTitle.textContent = `Bar ${bar + 1}`;
    if (existing) {
      els.barDlgText.textContent = `“${existing.name}” starts here. Rename it or remove the break.`;
      els.barName.value = existing.name;
      els.barSubmit.textContent = 'Rename';
      els.barRemove.hidden = false;
    } else {
      const pi = partIndexForBar(bar);
      const within = pi >= 0 ? state.parts[pi].label : 'the song';
      els.barDlgText.textContent = `This bar is inside “${within}”. Pick a name to start a new section here.`;
      els.barName.value = '';
      els.barSubmit.textContent = 'Start section';
      els.barRemove.hidden = true;
    }
    els.presetRow.innerHTML = '';
    const names = state.groups.filter((g) => !state.parts[g.occ[0]].synthetic).map((g) => g.name);
    PRESETS.forEach((n) => { if (!names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n); });
    names.forEach((name) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.style.setProperty('--seg', segColor(kindOf(name)));
      b.textContent = name;
      b.addEventListener('click', () => { els.barName.value = name; commitBarDialog(); });
      els.presetRow.appendChild(b);
    });
    // chords for this bar
    const rf = riffForBar(bar);
    els.barChords.value = (state.notes.chords[bar] != null ? state.notes.chords[bar] : chordsAt(bar).join(' '));
    els.barChords.dataset.initial = els.barChords.value;
    const times = rf ? riffBars(rf.riff, rf.offset).length : 1;
    els.barChordsAllLabel.hidden = !(rf && times > 1);
    els.barChordsAll.checked = true;
    if (rf) els.barChordsAllLabel.querySelector('span').textContent = `Every time riff ${rf.riff} plays (${times} times)`;
    els.barDlg.showModal();
  }

  function setChords(bar, text, everywhere) {
    const rf = riffForBar(bar);
    const bars = everywhere && rf ? riffBars(rf.riff, rf.offset) : [bar];
    // entered in the key shown; stored in the tab's own key
    const value = SM.chords.transposeText(text.trim(), -transposeSemis());
    bars.forEach((b) => {
      if (value) state.notes.chords[b] = value;
      else if (state.fileChords[b]) state.notes.chords[b] = '-';
      else delete state.notes.chords[b];
    });
    return bars.length;
  }

  function commitBarDialog() {
    const bar = state.barDlgIndex;
    const chordText = els.barChords.value;
    const chordsEdited = chordText !== els.barChords.dataset.initial;
    const name = els.barName.value.trim();
    if (chordsEdited) setChords(bar, chordText, els.barChordsAll.checked);
    if (name) {
      const existing = state.notes.sections.find((s) => s.start === bar);
      if (existing) {
        // the same part elsewhere in the song gets the new name too
        const oldBase = baseName(existing.name).toLowerCase();
        const same = state.notes.sections.filter((o) => baseName(o.name).toLowerCase() === oldBase);
        same.forEach((o) => { o.name = name; });
        if (same.length > 1) toast(`Renamed all ${same.length} “${baseName(name)}” sections`);
      } else {
        state.notes.sections.push({ id: uid(), start: bar, name });
      }
    } else if (!chordsEdited) {
      els.barName.focus();
      return;
    }
    closeDialog(els.barDlg);
    if (name) sectionsChanged(); else chordsChanged();
  }

  els.barForm.addEventListener('submit', (e) => { e.preventDefault(); commitBarDialog(); });
  els.barRemove.addEventListener('click', () => {
    state.notes.sections = state.notes.sections.filter((s) => s.start !== state.barDlgIndex);
    closeDialog(els.barDlg);
    sectionsChanged();
  });
  els.editBtn.addEventListener('click', () => setEditing(!state.editing));
  els.doneEditBtn.addEventListener('click', () => setEditing(false));

  // Looks for each part's notes elsewhere in the tab and marks those bars as the same part.
  function findRepeats() {
    const n = state.score.masterBars.length;
    const tokens = (i) => SM.analysis.barTokens(state.score, state.trackIndex, i).join(' ');
    const same = (a, b, len) => { for (let k = 0; k < len; k++) if (tokens(a + k) !== tokens(b + k)) return false; return true; };
    let added = 0;
    const named = state.groups.filter((g) => !state.parts[g.occ[0]].synthetic);
    named.sort((a, b) => state.parts[b.occ[0]].bars - state.parts[a.occ[0]].bars);
    named.forEach((g) => {
      const first = state.parts[g.occ[0]];
      const len = first.bars;
      let empty = true;
      for (let k = 0; k < len; k++) if (tokens(first.start + k)) empty = false;
      if (len < 2 || empty) return;
      for (let i = 0; i + len <= n; i++) {
        const covering = state.parts[partIndexForBar(i)];
        if (covering && covering.group.key === g.key) { i = covering.end; continue; }
        if (state.notes.sections.some((s) => s.start === i)) continue;
        if (state.notes.sections.some((s) => s.start > i && s.start < i + len)) continue;
        if (!same(first.start, i, len)) continue;
        const after = i + len;
        if (after < n && !state.notes.sections.some((s) => s.start === after)) {
          const was = state.parts[partIndexForBar(after)];
          state.notes.sections.push({ id: uid(), start: after, name: was && !was.synthetic ? was.name : 'Section' });
        }
        state.notes.sections.push({ id: uid(), start: i, name: first.name });
        added++;
        deriveParts();
        i += len - 1;
      }
    });
    return added;
  }

  els.findRepeatsBtn.addEventListener('click', () => {
    if (!sortedSections().length) { toast('Mark one verse or chorus first, then search for its repeats'); return; }
    let added = 0;
    for (let pass = 0; pass < 6; pass++) {
      const found = findRepeats();
      if (!found) break;
      added += found;
    }
    if (!added) { toast('No other matching passages found'); return; }
    sectionsChanged();
    toast(`Marked ${added} more ${added === 1 ? 'passage' : 'passages'} that match a part`);
  });
  els.suggestBtn.addEventListener('click', () => {
    if (sortedSections().length && !els.suggestBtn.classList.contains('confirm')) {
      els.suggestBtn.classList.add('confirm');
      els.suggestBtn.textContent = 'Replace all sections?';
      setTimeout(() => { els.suggestBtn.classList.remove('confirm'); els.suggestBtn.textContent = 'Suggest sections'; }, 3000);
      return;
    }
    els.suggestBtn.classList.remove('confirm');
    els.suggestBtn.textContent = 'Suggest sections';
    state.notes.sections = SM.analysis.suggestSections(state.score, state.trackIndex, chordsAt).map((s) => ({ id: uid(), ...s }));
    sectionsChanged();
    toast(`Suggested ${state.notes.sections.length} sections from the repeating patterns. Rename them to Verse, Chorus and so on.`);
  });
  els.useMarkersBtn.addEventListener('click', () => {
    if (!state.fileMarkers.length) { toast('This file has no section markers. Tap bars to add your own.'); return; }
    const times = {};
    (state.notes.sections || []).forEach((s) => { if (s.videoTime != null) times[s.start] = s.videoTime; });
    state.notes.sections = state.fileMarkers.map((m) => ({ ...m, id: uid(), videoTime: times[m.start] }));
    sectionsChanged();
    toast(`Loaded ${state.fileMarkers.length} markers from the file`);
  });

  /* ---------------- chord dialog (from the cards) ---------------- */
  function openChordDialog(bar, riffId, offset) {
    state.chordEdit = { bar, riffId, offset };
    const times = riffBars(riffId, offset).length;
    els.chordDlgTitle.textContent = `Riff ${riffId}, bar ${offset + 1}`;
    els.chordInput.value = chordsAt(bar).join(' ');
    els.chordAllLabel.hidden = times <= 1;
    els.chordAll.checked = true;
    els.chordAllLabel.querySelector('span').textContent = `Every time riff ${riffId} plays (${times} times)`;
    previewChords();
    els.chordDlg.showModal();
    setTimeout(() => els.chordInput.focus(), 50);
  }
  function previewChords() {
    const names = SM.chords.split(els.chordInput.value);
    els.chordPreview.innerHTML = names.map((n) => SM.chords.diagram(n, { width: 58 })).join('');
  }
  els.chordInput.addEventListener('input', previewChords);
  els.chordForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const n = setChords(state.chordEdit.bar, els.chordInput.value, els.chordAll.checked);
    closeDialog(els.chordDlg);
    chordsChanged();
    toast(n > 1 ? `Chords set in ${n} bars` : 'Chords saved');
  });
  els.chordClear.addEventListener('click', () => {
    els.chordInput.value = '';
    previewChords();
  });

  /* ---------------- player controls ---------------- */
  els.playBtn.addEventListener('click', () => {
    if (els.playBtn.disabled) { toast(soundProblem || 'Sounds are still loading'); return; }
    if (prefs.view === 'tab' || state.playing) { api.playPause(); return; }
    applyPlaybackRange();
    api.playPause();
  });
  els.loopBtn.addEventListener('click', () => {
    state.loop = !state.loop;
    els.loopBtn.setAttribute('aria-pressed', String(state.loop));
    api.isLooping = state.loop && !!api.playbackRange;
  });
  els.speedSel.addEventListener('change', () => {
    const v = Number(els.speedSel.value);
    api.playbackSpeed = v;
    if (ytPlayer && ytReady) ytPlayer.setPlaybackRate(v);
  });
  els.prevBtn.addEventListener('click', () => selectView(state.view - 1));
  els.nextBtn.addEventListener('click', () => selectView(state.view + 1));
  els.viewCards.addEventListener('click', () => setView('cards'));
  els.viewTab.addEventListener('click', () => setView('tab'));
  els.viewCardsTop.addEventListener('click', () => setView('cards'));
  els.viewTabTop.addEventListener('click', () => setView('tab'));

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea, dialog')) return;
    if (e.key === 'ArrowRight' && prefs.view === 'tab') selectView(state.view + 1);
    else if (e.key === 'ArrowLeft' && prefs.view === 'tab') selectView(state.view - 1);
    else if (e.key === ' ' && !els.playBtn.disabled) { e.preventDefault(); api.playPause(); }
  });

  /* ---------------- YouTube ---------------- */
  function loadYouTubeApi() {
    if (ytApi) return ytApi;
    ytApi = new Promise((resolve, reject) => {
      if (window.YT && window.YT.Player) return resolve();
      window.onYouTubeIframeAPIReady = () => resolve();
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { ytApi = null; reject(new Error('YouTube unavailable')); };
      document.head.appendChild(s);
    });
    return ytApi;
  }

  function setupVideo() {
    const id = youtubeId(state.notes && state.notes.youtubeUrl);
    els.videoBtn.hidden = !id;
    if (!id) {
      els.videoPanel.hidden = true;
      if (ytPlayer) { ytPlayer.destroy(); ytPlayer = null; ytReady = false; }
      const holder = document.createElement('div');
      holder.id = 'ytPlayer';
      els.videoPanel.querySelector('.video-frame').replaceChildren(holder);
      return;
    }
    els.videoPanel.hidden = !state.videoOn;
    els.videoBtn.setAttribute('aria-pressed', String(state.videoOn));
    loadYouTubeApi().then(() => {
      if (ytPlayer) { ytPlayer.cueVideoById(id); return; }
      ytPlayer = new window.YT.Player('ytPlayer', {
        videoId: id,
        playerVars: { playsinline: 1, rel: 0 },
        events: { onReady: () => { ytReady = true; renderEditList(); } }
      });
    }).catch(() => toast('YouTube could not be reached'));
  }

  function seekVideoToView() {
    if (!ytPlayer || !ytReady || state.view === -1) return;
    const t = state.parts[state.view].ref && state.parts[state.view].ref.videoTime;
    if (t != null) ytPlayer.seekTo(t, true);
  }

  // Loops the video inside the selected section and lights up the section the video is in.
  setInterval(() => {
    if (!ytPlayer || !ytReady || !state.parts.length || typeof ytPlayer.getPlayerState !== 'function') return;
    if (ytPlayer.getPlayerState() !== 1) return;
    const t = ytPlayer.getCurrentTime();
    // a section's video time is where it is first played
    const timed = state.parts.map((p, i) => ({ i, t: !p.again && p.ref && p.ref.start === p.start ? p.ref.videoTime : null })).filter((x) => x.t != null);
    if (!timed.length) return;
    if (state.view !== -1 && state.loop) {
      const start = state.parts[state.view].ref && state.parts[state.view].ref.videoTime;
      const next = timed.find((x) => x.t > (start ?? Infinity));
      if (start != null && next && t >= next.t) { ytPlayer.seekTo(start, true); return; }
    }
    let cur = -1;
    timed.forEach((x) => { if (x.t <= t) cur = x.i; });
    setPlayingPart(cur);
  }, 250);

  els.videoBtn.addEventListener('click', () => {
    state.videoOn = !state.videoOn;
    els.videoBtn.setAttribute('aria-pressed', String(state.videoOn));
    els.videoPanel.hidden = !state.videoOn;
  });

  /* ---------------- dialogs ---------------- */
  function closeDialog(d) { if (d.open) d.close(); }
  document.querySelectorAll('dialog').forEach((d) => {
    d.addEventListener('click', (e) => {
      if (e.target === d || e.target.closest('[data-close]')) closeDialog(d);
    });
  });

  /* ---------------- home: the band's songs ---------------- */
  // prefs.mode is chosen once on the welcome screen: 'band' (shared Google Drive folder) or 'solo' (this device).
  const drive = SM.library.sources.drive;
  const local = SM.library.sources.local;
  const inBand = () => prefs.mode === 'band';

  async function showHome() {
    if (updateWaiting) { refreshForUpdate(); return; }
    if (state.playing) api.stop();
    destroyMinis();
    if (state.editing) setEditing(false);
    els.songView.hidden = true;
    els.homeView.hidden = false;
    document.body.classList.remove('no-tab', 'paged');
    document.title = 'Setcards';
    await flushSave();   // so the list shows what was just changed
    renderHome();
  }

  function showSongView() {
    els.homeView.hidden = true;
    els.songView.hidden = false;
  }

  async function openFromList(key, title) {
    showSongView();
    const ok = await openSong(key, title);
    if (!ok) showHome();
  }

  const STATUS_LABELS = { proposed: 'Proposed', learning: 'Learning', ready: 'Ready' };
  // Songs added without tab start as proposed; songs from a tab file start as learning.
  const songStatus = (notes, hasTab) => (notes && STATUS_LABELS[notes.status] ? notes.status : (hasTab === false ? 'proposed' : 'learning'));

  // Fills a list section with songs, putting proposed songs in a section of their own after it.
  function songSections(wrap, src, songs, title, note, actionsFor) {
    const main = listSection(title, note);
    const proposed = listSection('Proposed', 'Songs suggested for the band, not learnt yet.');
    songs.forEach((s) => {
      const target = songStatus(s.notes, s.hasTab) === 'proposed' ? proposed : main;
      target.querySelector('ul').appendChild(songRow(src, s, actionsFor(s)));
    });
    wrap.appendChild(main);
    if (proposed.querySelector('li')) wrap.appendChild(proposed);
    return main;
  }

  // "Dm · 120 bpm · 4:14 · 12 sections", from the song's saved details
  function detailsLine(notes) {
    const m = (notes && notes.meta) || {};
    const keys = keysOf(notes);
    const band = keys.band || (m.key ? m.key + (m.keyGuessed ? '?' : '') : '');
    const key = keys.original && keys.band && SM.chords.semitonesBetween(keys.original, keys.band) ? `${band} (orig. ${keys.original})` : band;
    const tempo = (notes && notes.tempo) || m.tempo;
    const bits = [];
    if (key) bits.push(key);
    if (tempo) bits.push(`${tempo} bpm`);
    if (m.seconds) bits.push(fmtTime(m.seconds));
    if (notes && Array.isArray(notes.sections) && notes.sections.length) bits.push(plural(notes.sections.length, 'section'));
    return bits.join(' · ');
  }

  // Songs are listed in the order they were added (as in the band's Song list sheet), or by title or artist.
  const SORTS = [['added', 'Added'], ['title', 'Title'], ['artist', 'Artist']];
  const byText = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' });
  function compareSongs(a, b) {
    if (prefs.sort === 'title') return byText(a.title, b.title) || byText(a.artist, b.artist);
    // songs with no artist go after the rest
    if (prefs.sort === 'artist') return (!a.artist - !b.artist) || byText(a.artist, b.artist) || byText(a.title, b.title);
    // band songs follow the rows of the band's Song list sheet; songs on this device, the order they were added
    if (a.order != null && b.order != null) return a.order - b.order;
    return (a.addedAt || 0) - (b.addedAt || 0) || byText(a.title, b.title);
  }
  const sortSongs = (list) => list.sort(compareSongs);
  function addSortBar(container = els.songListWrap) {
    if (container.querySelector('.sort-bar')) return;
    const rows = container.querySelectorAll('.song-row');
    if (rows.length < 2) return;
    const bar = document.createElement('div');
    bar.className = 'sort-bar';
    bar.innerHTML = '<span class="fine">Order</span><div class="seg-toggle" role="group" aria-label="Order songs by"></div>';
    SORTS.forEach(([id, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = id === 'added' && inBand() ? 'Song list' : label;
      if (id === 'added' && inBand()) b.title = 'The order of the rows in the band’s Song list sheet';
      b.setAttribute('aria-pressed', String((prefs.sort || 'added') === id));
      b.addEventListener('click', () => {
        prefs.sort = id;
        savePrefs();
        bar.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        // re-sorts the rows already shown, so nothing is fetched again
        bar.parentNode.querySelectorAll('.song-list').forEach((ul) => {
          const lis = [...ul.querySelectorAll(':scope > .song-row')];
          lis.sort((x, y) => compareSongs(x.song, y.song)).forEach((li) => ul.appendChild(li));
        });
      });
      bar.querySelector('.seg-toggle').appendChild(b);
    });
    container.prepend(bar);
  }

  function songRow(src, s, extra) {
    const key = SM.library.key(src.id, s.id);
    const li = document.createElement('li');
    li.className = 'song-row';
    li.dataset.key = key;   // the open song is marked by markCurrent, so the list's HTML stays the same
    li.song = { title: s.title, artist: s.artist, addedAt: s.addedAt, order: s.order };
    const open = document.createElement('button');
    open.className = 'song-open';
    open.innerHTML = '<strong></strong><span class="who"></span><span class="details"></span>';
    open.querySelector('strong').textContent = s.title || 'Untitled';
    open.querySelector('.who').textContent = s.artist || '';
    const hasTab = s.hasTab !== false;
    open.querySelector('.details').textContent = hasTab ? (detailsLine(s.notes) || 'Open once to read its key and tempo') : ['No tab yet', detailsLine(s.notes)].filter(Boolean).join(' · ');
    const status = songStatus(s.notes, hasTab);
    if (status !== 'ready') {
      const chip = document.createElement('span');
      chip.className = `status-chip status-${status}`;
      chip.textContent = STATUS_LABELS[status];
      open.querySelector('strong').after(chip);
    }
    open.addEventListener('click', () => openFromList(key, s.title));
    li.appendChild(open);
    if (extra) li.appendChild(extra);
    return li;
  }

  function deleteButton(src, s, label) {
    const del = document.createElement('button');
    del.className = 'song-del';
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      if (!del.classList.contains('confirm')) {
        del.classList.add('confirm');
        del.textContent = label;
        setTimeout(() => { del.classList.remove('confirm'); del.textContent = 'Delete'; }, 3000);
        return;
      }
      try { await src.remove(s.id); } catch (e) { toast(e.message); }
      renderHome();
    });
    return del;
  }

  function listSection(title, note) {
    const sec = document.createElement('section');
    sec.className = 'list-section';
    sec.innerHTML = `<h2 class="list-title"></h2>${note ? '<p class="fine list-note"></p>' : ''}<ul class="song-list"></ul>`;
    sec.querySelector('.list-title').textContent = title;
    if (note) sec.querySelector('.list-note').textContent = note;
    return sec;
  }

  // The list is built off screen and only swapped in when it differs from what is shown, so a refresh that
  // finds nothing new doesn't move anything on screen.
  async function renderHome() {
    const fresh = document.createElement('div');
    await buildHome(fresh);
    addSortBar(fresh);
    showList(fresh);
  }
  function showList(fresh) {
    diag.hide();
    const live = els.songListWrap;
    live.querySelectorAll('.song-row.current').forEach((r) => r.classList.remove('current'));
    if (live.innerHTML !== fresh.innerHTML) {
      live.textContent = '';
      while (fresh.firstChild) live.appendChild(fresh.firstChild);
    }
    markCurrent(live);
  }
  function markCurrent(root) {
    root.querySelectorAll('.song-row').forEach((r) => r.classList.toggle('current', !!state.song && r.dataset.key === state.song.key));
  }

  // A line under the top bar while something is being fetched (the band's songs, a new version of the app),
  // so you can wait for it if you're expecting a change.
  const syncTasks = new Map();
  // The refresh icon in the title bar shows what is being checked; a tap checks the band folder again.
  let syncLast = 'Up to date';
  let syncFailed = false;
  function drawSync() {
    const btn = els.syncBtn;
    const busy = [...syncTasks.values()];
    btn.classList.toggle('busy', busy.length > 0);
    btn.classList.toggle('warn', !busy.length && syncFailed);
    const text = busy.length ? busy[busy.length - 1] : syncLast;
    btn.title = text;
    btn.setAttribute('aria-label', `Refresh. ${text}`);
  }
  function syncStart(id, text) { syncTasks.set(id, text); drawSync(); }
  function syncEnd(id, doneText, failed) {
    syncTasks.delete(id);
    if (doneText) { syncLast = doneText; syncFailed = !!failed; }
    drawSync();
  }
  async function buildHome(wrap) {
    els.homeRoleBtn.textContent = role().label;
    els.welcome.hidden = !!prefs.mode;
    els.homeRoleBtn.hidden = !prefs.mode;   // asked on the welcome screen first
    els.homeView.querySelector('.home-foot').hidden = !prefs.mode;
    els.bandBox.hidden = true;
    els.shareUploadWrap.hidden = !(inBand() && drive.connected() && drive.signedIn());
    els.bandName.textContent = inBand() ? (drive.folder() ? drive.folder().name : 'No band folder yet') : (prefs.mode === 'solo' ? 'On this device' : '');
    if (!prefs.mode) return;

    if (inBand()) {
      if (!drive.configured()) {
        renderBandBox('This copy of Setcards has no Google sign-in set up, so it can only keep songs on this device for now.');
      } else if (!drive.connected()) {
        renderBandBox();
      } else if (!drive.signedIn()) {
        const box = els.bandBox;
        box.hidden = false;
        box.innerHTML = `<p>Sign in to Google to see <strong></strong>’s songs.</p><button class="text-btn primary" id="homeSignIn" type="button">Show band songs</button>`;
        box.querySelector('strong').textContent = drive.folder().name;
        box.querySelector('#homeSignIn').addEventListener('click', async () => {
          try { await drive.signIn(); renderHome(); } catch (e) { toast(e.message); }
        });
        // the copy kept on this phone, so songs are there even before signing in or without a connection
        const saved = await drive.listSaved().catch(() => null);
        if (saved && saved.length) {
          sortSongs(saved);
          songSections(wrap, drive, saved, drive.folder().name, `Saved on this phone ${savedWhen(saved[0].savedAt)}. Sign in to see the latest.`, () => null);
        }
      } else {
        // the copy kept on this phone shows straight away, while the latest is fetched
        const saved = await drive.listSaved().catch(() => null);
        const loading = document.createElement('p');
        loading.className = 'fine';
        if (saved && saved.length) songSections(wrap, drive, sortSongs(saved), drive.folder().name, '', () => null);
        else { loading.textContent = 'Loading songs…'; wrap.appendChild(loading); }
        // with nothing on screen yet, the saved copy or the loading line shows now; otherwise the list stays until the latest arrives
        if (!els.songListWrap.querySelector('.song-row')) { addSortBar(wrap); showList(wrap); }
        syncStart('songs', 'Checking Google Drive for changes…');
        let sec;
        try {
          // a connection that stalls is reported, rather than the check spinning on
          const songs = await Promise.race([
            drive.list(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Google Drive is taking too long to answer. Tap the refresh icon to try again.')), 30000))
          ]);
          wrap.innerHTML = '';
          syncEnd('songs', songs.length && songs[0].offline ? 'Couldn’t reach Google Drive, so this is the copy on this phone' : 'Up to date', songs.length && songs[0].offline);
          sortSongs(songs);
          const isOffline = songs.length && songs[0].offline;
          const note = isOffline ? `Offline: showing the copy saved on this phone ${savedWhen(songs[0].savedAt)}.` : '';
          sec = songSections(wrap, drive, songs, drive.folder().name, note, (s) => (isOffline ? null : deleteButton(drive, s, 'Delete for the band?')));
          if (!isOffline) sendKeptChanges(songs);
          if (!songs.length) sec.querySelector('ul').innerHTML = '<li class="fine">No songs visible yet. Add one below, or if the folder already has songs, give Setcards access to them.</li>';
        } catch (e) {
          syncEnd('songs', 'Could not check Google Drive: ' + e.message, true);
          wrap.innerHTML = '';
          loading.textContent = e.message;
          wrap.appendChild(loading);
          sec = listSection(drive.folder().name);
          wrap.appendChild(sec);
        }
        const more = document.createElement('button');
        more.className = 'text-btn';
        more.textContent = 'Missing a song someone added? Give Setcards access';
        more.addEventListener('click', async () => {
          try { const n = await drive.grantAccess(); if (n) toast(`Setcards can now open ${plural(n, 'more song')}`); } catch (e) { toast(e.message); }
          renderHome();
        });
        sec.appendChild(more);
      }
    }

    // Songs only on this device: drafts when in a band, the whole list when on your own.
    let mine = [];
    try { mine = await local.list(); } catch (e) { mine = []; }
    if (inBand()) mine = mine.filter((s) => !s.isDemo);
    if (inBand() && !mine.length) return;
    sortSongs(mine);
    const actionsFor = (s) => {
      const actions = document.createElement('div');
      actions.className = 'row-actions';
      if (inBand() && s.canShare && drive.connected()) {
        const share = document.createElement('button');
        share.className = 'text-btn';
        share.textContent = 'Share with band';
        share.addEventListener('click', () => shareDraft(s));
        actions.appendChild(share);
      }
      actions.appendChild(deleteButton(local, s, 'Tap to confirm'));
      return actions;
    };
    let sec;
    if (inBand()) {
      sec = listSection('Drafts', 'Only on this device until you share them with the band.');
      mine.forEach((s) => sec.querySelector('ul').appendChild(songRow(local, s, actionsFor(s))));
      wrap.appendChild(sec);
    } else {
      sec = songSections(wrap, local, mine, 'Your songs', '', actionsFor);
    }
    const ul = sec.querySelector('ul');
    if (!mine.length) {
      const li = document.createElement('li');
      li.className = 'fine';
      li.innerHTML = 'No songs yet. Add one below, or <button class="link-btn" id="addDemoBtn" type="button">try the demo song</button>.';
      li.querySelector('#addDemoBtn').addEventListener('click', async () => { await addDemo(); renderHome(); });
      ul.appendChild(li);
    }
  }

  function savedWhen(t) {
    if (!t) return '';
    const mins = Math.round((Date.now() - t) / 60000);
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins} minutes ago`;
    const d = new Date(t);
    return `on ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} at ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }

  // Changes that couldn't reach Drive were kept on this phone; send them now that it can be reached.
  function sendKeptChanges(songs) {
    songs.forEach((sg) => {
      const key = SM.library.key('drive', sg.id);
      const kept = SM.library.overlay.get(key);
      if (kept && (!sg.notes || (kept.updatedAt || 0) > (sg.notes.updatedAt || 0))) {
        SM.library.saveNotes(key, kept).then((r) => { if (!r.local) toast(`Sent your changes to “${sg.title}”`); });
      }
    });
  }

  // Moves a draft into the band folder, with its sections and chords.
  async function shareDraft(s) {
    try {
      if (!drive.signedIn()) await drive.signIn();
      const song = await local.open(s.id);
      if (song.tex) { toast('The demo song can’t be shared'); return; }
      toast('Sharing with the band…');
      const notes = Object.assign({}, song.notes, { updatedAt: Date.now() });
      await drive.add(song.bytes ? (song.fileName || `${s.title}.gp`) : null, song.bytes, notes);
      await local.remove(s.id);
      toast(`“${s.title}” is now in the band folder`);
    } catch (e) {
      toast(e.message);
    }
    renderHome();
  }

  // Connect or create the band folder, shown on the home screen and in Band settings.
  function renderBandBox(message) {
    const box = els.bandBox;
    box.hidden = false;
    if (message) {
      box.innerHTML = `<p class="fine"></p><button class="text-btn" id="soloInstead" type="button">Use Setcards on this device only</button>`;
      box.querySelector('p').textContent = message;
      box.querySelector('#soloInstead').addEventListener('click', () => setMode('solo'));
      return;
    }
    box.innerHTML = `<p>Connect your band’s Google Drive folder. If a bandmate sent you an invite link, open that instead.</p>
      <div class="row-btns">
        <button class="text-btn primary" id="gPick" type="button">Connect band folder</button>
        <button class="text-btn" id="gCreate" type="button">Start a new band folder</button>
      </div>
      <form id="gCreateForm" class="inline-form" hidden>
        <input id="gBandName" placeholder="Band name" autocomplete="off" aria-label="Band name">
        <button class="text-btn primary" type="submit">Create</button>
      </form>`;
    box.querySelector('#gPick').addEventListener('click', async () => {
      try { const f = await drive.connect(); if (f) toast(`Connected to “${f.name}”`); } catch (e) { toast(e.message); }
      renderHome();
    });
    const form = box.querySelector('#gCreateForm');
    box.querySelector('#gCreate').addEventListener('click', () => { form.hidden = false; form.querySelector('input').focus(); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = form.querySelector('input').value.trim() || 'My band';
      try {
        const f = await drive.createFolder(`${name} (Setcards)`);
        toast(`Created “${f.name}”. Share it with your band in Google Drive, then send them the invite link from Band settings.`);
      } catch (err) { toast(err.message); }
      renderHome();
    });
  }

  function setMode(mode) {
    prefs.mode = mode;
    savePrefs();
    closeDialog(els.bandDlg);
    renderHome();
  }

  // First visit: what you play (bass, guitar and vocals first; keys and drums too), then band or just you.
  function renderWelcomeRoles() {
    const box = els.welcomeRoles;
    box.innerHTML = '';
    [...ROLES.filter((r) => r.offer), ...ROLES.filter((r) => !r.offer)].forEach((r) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'choice role-choice' + (r.offer ? '' : ' minor');
      b.dataset.role = r.id;
      b.setAttribute('aria-pressed', String(!!prefs.roleChosen && prefs.role === r.id));
      b.innerHTML = '<strong></strong>' + (r.offer ? '<span></span>' : '');
      b.querySelector('strong').textContent = r.label;
      if (r.offer) b.querySelector('span').textContent = r.offer;
      b.addEventListener('click', () => {
        setRole(r.id);
        box.querySelectorAll('.role-choice').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        els.welcomeMode.hidden = false;
        els.welcomeMode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      box.appendChild(b);
    });
    els.welcomeMode.hidden = !prefs.roleChosen;
  }
  renderWelcomeRoles();

  els.chooseBand.addEventListener('click', () => setMode('band'));
  els.chooseSolo.addEventListener('click', () => setMode('solo'));

  async function shareInvite(link, name) {
    const text = `Join “${name}” on Setcards`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Setcards', text, url: link }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(link);
      toast('Invite link copied. Send it to your bandmate.');
    } catch (e) {
      toast(link);
    }
  }

  // Band settings: the folder, the invite link, and switching between band and this-device-only.
  function renderBandDialog() {
    const box = els.driveBox;
    const modeBox = els.modeBox;
    box.innerHTML = '';
    modeBox.innerHTML = '';
    if (inBand() && drive.connected()) {
      const f = drive.folder();
      box.innerHTML = `<p>Band folder: <a href="${esc(drive.folderUrl())}" target="_blank" rel="noopener">${esc(f.name)}</a></p>
        <p class="fine">To add a bandmate, share that folder with them in Google Drive, then send them the invite link.</p>
        <div class="row-btns"><button class="text-btn primary" id="gInvite" type="button">Share invite link</button><button class="text-btn" id="gDisconnect" type="button">Leave this folder</button></div>`;
      box.querySelector('#gInvite').addEventListener('click', () => shareInvite(drive.inviteLink(), f.name));
      const sheetUrl = drive.songListUrl();
      if (sheetUrl) {
        const p = document.createElement('p');
        p.className = 'fine';
        p.innerHTML = 'The band’s songs are also listed in the <a target="_blank" rel="noopener">Song list</a> sheet in that folder, for anyone who prefers a spreadsheet. Setcards keeps it up to date; changes made in the sheet aren’t read back.';
        p.querySelector('a').href = sheetUrl;
        box.insertBefore(p, box.querySelector('.row-btns'));
      }
      box.querySelector('#gDisconnect').addEventListener('click', () => { drive.disconnect(); closeDialog(els.bandDlg); renderHome(); });
    } else if (inBand()) {
      box.innerHTML = '<p class="fine">No band folder connected yet. Connect one from the home screen.</p>';
    }
    if (!drive.configured()) {
      const adv = document.createElement('details');
      adv.className = 'advanced';
      adv.innerHTML = `<summary>Set up Google sign-in for this copy</summary>
        <label class="field"><span>Client ID</span><input id="gClientId" placeholder="….apps.googleusercontent.com"></label>
        <label class="field"><span>API key (for the file picker)</span><input id="gApiKey"></label>
        <label class="field"><span>Project number</span><input id="gAppId" inputmode="numeric"></label>
        <button class="text-btn primary" id="gSave" type="button">Save</button>`;
      adv.querySelector('#gSave').addEventListener('click', () => {
        drive.setClient({ clientId: adv.querySelector('#gClientId').value.trim(), apiKey: adv.querySelector('#gApiKey').value.trim(), appId: adv.querySelector('#gAppId').value.trim() });
        renderBandDialog();
        renderHome();
      });
      box.appendChild(adv);
    }
    const p = document.createElement('p');
    p.className = 'fine';
    const btn = document.createElement('button');
    btn.className = 'text-btn';
    btn.type = 'button';
    if (inBand()) {
      p.textContent = 'Using Setcards with a band. Songs you keep as drafts stay on this device.';
      btn.textContent = 'Use on this device only instead';
      btn.addEventListener('click', () => setMode('solo'));
    } else {
      p.textContent = 'Using Setcards on this device only.';
      btn.textContent = 'Use with my band';
      btn.addEventListener('click', () => setMode('band'));
    }
    const v = String(window.SETCARDS_VERSION || '');
    const ver = document.createElement('p');
    ver.className = 'fine version';
    ver.textContent = `Setcards version ${v.startsWith('__') ? 'in development' : v}`;
    modeBox.append(p, btn, ver);
  }

  els.bandBtn.addEventListener('click', () => { renderBandDialog(); els.bandDlg.showModal(); });
  els.backBtn.addEventListener('click', showHome);

  // Opening the app from an invite link (?band=<folder id>&name=<folder name>) offers to join that folder.
  function checkInvite() {
    const params = new URLSearchParams(location.search);
    const id = params.get('band');
    if (!id) return;
    const name = params.get('name') || 'band folder';
    const clear = () => history.replaceState(null, '', location.pathname);
    const current = drive.folder();
    if (current && current.id === id) { clear(); prefs.mode = 'band'; savePrefs(); toast(`You're already connected to “${current.name}”`); return; }
    els.joinTitle.textContent = `Join “${name}”`;
    els.joinBtn.onclick = async () => {
      closeDialog(els.joinDlg);
      try {
        const f = await drive.connect(id);
        if (!f) { toast('Not connected. Open the invite link again to retry.'); return; }
        clear();
        prefs.mode = 'band';
        savePrefs();
        toast(`Connected to “${f.name}”`);
        renderHome();
        // someone joining from an invite skips the welcome, so ask what they play here
        if (!prefs.roleChosen) openRoles();
      } catch (e) {
        toast(e.message);
      }
    };
    els.joinDlg.showModal();
  }

  els.addSongBtn.addEventListener('click', () => {
    els.addForm.reset();
    els.addStatus.value = 'proposed';
    els.shareUploadWrap.hidden = !(inBand() && drive.connected() && drive.signedIn());
    els.addDlg.showModal();
    setTimeout(() => els.addTitle.focus(), 50);
  });
  // A song with just a name, artist and maybe a video; its tab can be attached later.
  els.addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = els.addTitle.value.trim();
    if (!title) { els.addTitle.focus(); return; }
    const yt = els.addYt.value.trim();
    if (yt && !youtubeId(yt)) { toast('That does not look like a YouTube link'); return; }
    const meta = { title, artist: els.addArtist.value.trim() };
    const notes = SM.library.emptyNotes(meta);
    notes.status = els.addStatus.value;
    notes.youtubeUrl = yt;
    const toBand = inBand() && drive.connected() && drive.signedIn() && els.shareUpload.checked;
    const source = toBand ? drive : local;
    closeDialog(els.addDlg);
    try {
      const id = await source.add(null, null, notes, meta);
      await openFromList(SM.library.key(source.id, id));
      toast(toBand ? `Added “${title}” for the band` : (inBand() ? `Added “${title}” to your drafts` : `Added “${title}”`));
    } catch (err) {
      toast(err.message);
    }
  });

  els.fileInput.addEventListener('change', () => {
    importFile(els.fileInput.files[0]);
    els.fileInput.value = '';
  });

  /* ---------------- settings ---------------- */
  function fillTrackSelect() {
    els.trackSel.innerHTML = '';
    state.score.tracks.forEach((t, i) => {
      const o = document.createElement('option');
      o.value = i;
      const name = (t.name || '').trim() || `Track ${i + 1}`;
      const twin = state.score.tracks.some((u, j) => j !== i && (u.name || '').trim() === (t.name || '').trim());
      // tell apart a notation copy and a tab copy of the same part
      const st = t.staves[0];
      o.textContent = twin && st ? `${name} (${st.showTablature ? 'tab' : 'notation'})` : name;
      els.trackSel.appendChild(o);
    });
    els.trackSel.value = state.trackIndex;
  }

  els.settingsBtn.addEventListener('click', () => {
    if (!state.song) return;
    els.zoomRange.value = prefs.zoom;
    els.zoomOut.textContent = `${Math.round(prefs.zoom * 100)}%`;
    els.ytInput.value = state.notes.youtubeUrl || '';
    const m = state.notes.meta || {};
    els.statusSel.value = songStatus(state.notes, state.song.hasTab);
    fillKeySettings();
    els.tempoInput.value = state.notes.tempo || '';
    els.tempoInput.placeholder = m.tempo ? String(m.tempo) : '120';
    els.showTabCards.checked = showTabInCards();
    els.showChords.checked = showChords();
    document.querySelectorAll('input[name="stave"]').forEach((r) => { r.checked = r.value === prefs.stave; });
    els.settingsDlg.showModal();
  });
  els.trackSel.addEventListener('change', () => {
    const i = Number(els.trackSel.value);
    prefs.tracks[state.song.key] = Object.assign({}, prefs.tracks[state.song.key], { [prefs.role]: i });
    savePrefs();
    state.partMissing = false;
    updateBanner();
    useTrack(i);
  });
  // The full tab shows chord names above the bars only when this instrument shows chords.
  function applyChordVisibility() {
    const show = showChords();
    const els2 = api.settings.notation.elements;
    if (els2.get(AT.NotationElement.EffectChordNames) === show) return false;
    els2.set(AT.NotationElement.EffectChordNames, show);
    api.updateSettings();
    return true;
  }
  els.showChords.addEventListener('change', () => {
    prefs.chords[prefs.role] = els.showChords.checked;
    savePrefs();
    applyChordVisibility();
    if (prefs.view === 'tab') api.render(); else renderCards();
  });
  els.showTabCards.addEventListener('change', () => {
    prefs.cardsTab[prefs.role] = els.showTabCards.checked;
    savePrefs();
    if (prefs.view === 'cards') renderCards();
  });
  document.querySelectorAll('input[name="stave"]').forEach((r) => r.addEventListener('change', () => {
    prefs.stave = r.value;
    savePrefs();
    api.settings.display.staveProfile = STAVES[r.value];
    api.updateSettings();
    if (prefs.view === 'tab') api.render(); else renderCards();
  }));
  els.zoomRange.addEventListener('input', () => { els.zoomOut.textContent = `${Math.round(els.zoomRange.value * 100)}%`; });
  function setZoom(z) {
    z = Math.round(Math.min(1.8, Math.max(0.6, z)) * 10) / 10;
    prefs.zoom = z;
    savePrefs();
    api.settings.display.scale = z;
    api.updateSettings();
    if (prefs.view === 'tab') api.render(); else renderCards();
    toast(`Tab size ${Math.round(z * 100)}%`);
  }
  els.zoomRange.addEventListener('change', () => setZoom(Number(els.zoomRange.value)));
  $('zoomOutBtn').addEventListener('click', () => setZoom(prefs.zoom - 0.1));
  $('zoomInBtn').addEventListener('click', () => setZoom(prefs.zoom + 0.1));
  els.statusSel.addEventListener('change', () => {
    setStatus(els.statusSel.value);
    if (!state.song.hasTab) renderNoTab();
  });
  function fillKeySettings() {
    const k = keysOf(state.notes);
    const m = state.notes.meta || {};
    fillKeySelect(els.originalKeyInput, state.notes.originalKey, 'Not set');
    fillKeySelect(els.bandKeyInput, state.notes.bandKey || state.notes.key, 'Not set');
    fillKeySelect(els.tabKeyInput, state.notes.tabKey, m.key ? `${SM.chords.keyName(m.key)}${m.keyGuessed ? ' (estimated)' : ''}` : 'Not set');
    els.bandTrOut.textContent = signed(bandTranspose());
    els.myTrOut.textContent = myTranspose() === undefined ? 'same' : signed(myTranspose());
    els.myTrReset.disabled = myTranspose() === undefined;
    const toBand = SM.chords.semitonesBetween(k.tab, k.band);
    els.matchKeyBtn.disabled = toBand === null || toBand === bandTranspose();
    els.keyInfo.textContent = keyInfoText();
  }
  // Every key is a note and a scale (major or minor), so a choice of 24; a key typed in an older version is kept as it was.
  function fillKeySelect(sel, value, emptyText) {
    const C = SM.chords;
    const k = C.keyOf(value);
    const groups = [['Major', C.KEY_NAMES.major], ['Minor', C.KEY_NAMES.minor]];
    sel.innerHTML = '';
    sel.add(new Option(emptyText, ''));
    let found = !value;
    groups.forEach(([label, names]) => {
      const g = document.createElement('optgroup');
      g.label = label;
      names.forEach((n) => {
        const nk = C.keyOf(n);
        // the stored spelling wins (Gb rather than F#)
        const same = k && nk.root === k.root && nk.minor === k.minor;
        const o = new Option(same ? k.name : nk.name, same ? value : n);
        if (same) { o.selected = true; found = true; }
        g.appendChild(o);
      });
      sel.appendChild(g);
    });
    if (!found) { const o = new Option(value, value); o.selected = true; sel.add(o, 1); }
  }
  const keyField = (input, field) => input.addEventListener('change', () => {
    const v = input.value.trim();
    if (v) state.notes[field] = v; else delete state.notes[field];
    if (field === 'bandKey') delete state.notes.key;   // older songs kept the band key as "key"
    saveNotes();
    fillKeySettings();
    updateSongMeta();
    refreshSongKeys();
  });
  function refreshSongKeys() {
    const old = els.cards.querySelector('.song-keys');
    if (old) old.replaceWith(songKeysBlock());
    if (state.score) updateHeader();
  }
  keyField(els.originalKeyInput, 'originalKey');
  keyField(els.bandKeyInput, 'bandKey');
  keyField(els.tabKeyInput, 'tabKey');
  els.bandTrDown.addEventListener('click', () => setTranspose(bandTranspose() - 1));
  els.bandTrUp.addEventListener('click', () => setTranspose(bandTranspose() + 1));
  els.matchKeyBtn.addEventListener('click', () => {
    const k = keysOf(state.notes);
    setTranspose(SM.chords.semitonesBetween(k.tab, k.band) || 0, null);
  });
  els.myTrDown.addEventListener('click', () => setTranspose(undefined, transposeSemis() - 1));
  els.myTrUp.addEventListener('click', () => setTranspose(undefined, transposeSemis() + 1));
  els.myTrReset.addEventListener('click', () => setTranspose(undefined, null));
  els.tempoInput.addEventListener('change', () => {
    const v = Math.round(Number(els.tempoInput.value));
    if (v > 0) state.notes.tempo = v; else delete state.notes.tempo;
    els.tempoInput.value = state.notes.tempo || '';
    saveNotes();
    updateSongMeta();
  });
  els.ytInput.addEventListener('change', () => {
    const v = els.ytInput.value.trim();
    if (v && !youtubeId(v)) { toast('That does not look like a YouTube link'); return; }
    state.notes.youtubeUrl = v;
    saveNotes();
    setupVideo();
  });

  // A copy of the Guitar Pro file with the sections, riff letters and chord names written in.
  els.exportBtn.addEventListener('click', () => {
    try {
      const data = new AT.exporter.Gp7Exporter().export(state.score, api.settings);
      const blob = new Blob([data], { type: 'application/octet-stream' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(state.song.title || 'song').replace(/[\\/:*?"<>|]+/g, '')} (Setcards).gp`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    } catch (e) {
      console.error(e);
      toast('The annotated file could not be created');
    }
  });

  /* ---------------- drag and drop ---------------- */
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { dragDepth++; els.drop.hidden = false; } });
  window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) els.drop.hidden = true; });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    els.drop.hidden = true;
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (f) importFile(f);
  });

  /* ---------------- start ---------------- */
  // The app always opens on the band's song list.
  els.roleBtn.textContent = role().label;
  applyViewChrome();
  applyChordVisibility();
  drive.preload();
  showHome();
  checkInvite();

  // Updates: an installed app is often resumed rather than reloaded, so check for a new version whenever
  // it comes to the front. When one takes over, refresh onto it: straight away on the song list, or
  // when going back to the list if a song is open.
  function refreshForUpdate() {
    flushSave(true);
    location.reload();
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || updateWaiting) return;
      updateWaiting = true;
      if (!els.homeView.hidden) refreshForUpdate();
      else toast('Setcards has been updated. It will refresh when you go back to the song list.');
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        // a new version downloading: say so until it takes over (and the page refreshes)
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!hadController || !sw) return;
          syncStart('app', 'Updating Setcards…');
          // done once the new version is active (the page then reloads onto it), or if it is dropped;
          // a safety stop so the icon can never spin forever
          const done = () => syncEnd('app', '');
          sw.addEventListener('statechange', () => { if (sw.state === 'activated' || sw.state === 'redundant') done(); });
          setTimeout(done, 60000);
        });
        const check = () => {
          if (!hadController) return;
          syncStart('check', 'Checking for a new version of Setcards…');
          reg.update().catch(() => {}).finally(() => syncEnd('check', ''));
        };
        check();
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      }).catch(() => {});
    });
  }
})();
