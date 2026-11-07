/* Setcards: Guitar Pro songs as short section cards for every player in the band. */
(function () {
  'use strict';
  const AT = window.alphaTab;
  const SM = window.SM;
  const $ = (id) => document.getElementById(id);

  const els = {
    songTitle: $('songTitle'), songMeta: $('songMeta'), chartStatus: $('chartStatus'), capoSel: $('capoSel'), songTitleInput: $('songTitleInput'), songArtistInput: $('songArtistInput'), moreBtn: $('moreBtn'),
    structure: $('structure'),
    viewSelTop: $('viewSelTop'), viewSelSet: $('viewSelSet'), roleSel: $('roleSel'), chart: $('chart'), chartEditor: $('chartEditor'),
    sectionHead: $('sectionHead'), sectionName: $('sectionName'), sectionBars: $('sectionBars'),
    prevBtn: $('prevBtn'), nextBtn: $('nextBtn'),
    editBtn: $('editBtn'), editPanel: $('editPanel'), sectionList: $('sectionList'),
    findRepeatsBtn: $('findRepeatsBtn'), suggestBtn: $('suggestBtn'), useMarkersBtn: $('useMarkersBtn'), doneEditBtn: $('doneEditBtn'),
    syncBtn: $('syncBtn'), scroller: $('scroller'), tab: $('tab'), cards: $('cards'), loading: $('loading'), drop: $('drop'),
    noticeBtn: $('noticeBtn'), noticeDlg: $('noticeDlg'), noticeText: $('noticeText'),
    playBtn: $('playBtn'), skipBtn: $('skipBtn'), drumsBtn: $('drumsBtn'), speedSel: $('speedSel'),
    videoBtn: $('videoBtn'), videoPanel: $('videoPanel'), playerStatus: $('playerStatus'),
    homeView: $('homeView'), songView: $('songView'), backBtn: $('backBtn'), bandName: $('bandName'), homeRoleBtn: $('homeRoleBtn'),
    bandBtn: $('bandBtn'), bandDlg: $('bandDlg'), driveBox: $('driveBox'), modeBox: $('modeBox'),
    welcome: $('welcome'), welcomeRoles: $('welcomeRoles'), welcomeMode: $('welcomeMode'), chooseBand: $('chooseBand'), chooseSolo: $('chooseSolo'), bandBox: $('bandBox'), songListWrap: $('songListWrap'),
    fileInput: $('fileInput'), shareUpload: $('shareUpload'), shareUploadWrap: $('shareUploadWrap'),
    originalKeyInput: $('originalKeyInput'), bandKeyInput: $('bandKeyInput'), tabKeyInput: $('tabKeyInput'), keyInfo: $('keyInfo'),
    bandTrDown: $('bandTrDown'), bandTrUp: $('bandTrUp'), bandTrOut: $('bandTrOut'), matchKeyBtn: $('matchKeyBtn'),
    noteEditBar: $('noteEditBar'), noteEditCount: $('noteEditCount'), noteDiscard: $('noteDiscard'), noteSave: $('noteSave'),
    myTrDown: $('myTrDown'), myTrUp: $('myTrUp'), myTrOut: $('myTrOut'), myTrReset: $('myTrReset'),
    tempoInput: $('tempoInput'), statusSel: $('statusSel'), noTab: $('noTab'),
    addSongBtn: $('addSongBtn'), addDlg: $('addDlg'), addForm: $('addForm'), addTitle: $('addTitle'), addArtist: $('addArtist'),
    addYt: $('addYt'), addStatus: $('addStatus'),
    noteDlg: $('noteDlg'), noteTitle: $('noteTitle'), noteHint: $('noteHint'), noteForm: $('noteForm'), noteText: $('noteText'), noteClear: $('noteClear'),
    settingsBtn: $('settingsBtn'), settingsDlg: $('settingsDlg'), trackSel: $('trackSel'),
    barPeekDlg: $('barPeekDlg'), barPeekTitle: $('barPeekTitle'), barPeekBody: $('barPeekBody'),
    zoomRange: $('zoomRange'), zoomOut: $('zoomOut'), ytInput: $('ytInput'), exportBtn: $('exportBtn'), showTabCards: $('showTabCards'), showChords: $('showChords'), audioInput: $('audioInput'), audioRemove: $('audioRemove'), kitSel: $('kitSel'), kitInput: $('kitInput'), drumFeel: $('drumFeel'), drumFeelOut: $('drumFeelOut'), drumLoud: $('drumLoud'), drumSwell: $('drumSwell'), countIn: $('countIn'), clickBars: $('clickBars'), clickLevel: $('clickLevel'), clickLevelOut: $('clickLevelOut'), countInLevel: $('countInLevel'), countInLevelOut: $('countInLevelOut'), soundLogText: $('soundLogText'), soundLogCopy: $('soundLogCopy'), appVersion: $('appVersion'),
    barDlg: $('barDlg'), barDlgTitle: $('barDlgTitle'), barDlgText: $('barDlgText'),
    presetRow: $('presetRow'), barForm: $('barForm'), barName: $('barName'), barSubmit: $('barSubmit'), barRemove: $('barRemove'),
    barChords: $('barChords'), barChordsAll: $('barChordsAll'), barChordsAllLabel: $('barChordsAllLabel'),
    chordDlg: $('chordDlg'), chordDlgTitle: $('chordDlgTitle'), chordForm: $('chordForm'), chordInput: $('chordInput'),
    chordAll: $('chordAll'), chordAllLabel: $('chordAllLabel'), chordClear: $('chordClear'), chordPreview: $('chordPreview'),
    chordPanel: $('chordPanel'), chordPanelBody: $('chordPanelBody'), chordPanelCount: $('chordPanelCount'),
    chordPanelDiscard: $('chordPanelDiscard'), chordPanelSave: $('chordPanelSave'), chordPanelDone: $('chordPanelDone'), sectionEdit: $('sectionEdit'),
    tabPartList: $('tabPartList'), listenBtn: $('listenBtn'), fillFromTabBtn: $('fillFromTabBtn'),
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
  const prefs = Object.assign({ role: 'bass', view: 'cards', zoom: 1, stave: 'tab', last: null, tracks: {}, cardsTab: {}, chords: {}, transpose: {}, viewBySong: {} }, readJson('setcards:prefs'));
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
    playing: false,
    playingPart: -1,
    videoOn: false,
    barDlgIndex: 0,
    noteEdit: null,
    chordEdit: null
  };

  let updateWaiting = false;   // a new version of the app is ready and will load at the next good moment
  let swRegistration = null;   // the app's service worker, so the refresh icon can look for a new version
  let ytPlayer = null;
  let ytReady = false;
  let audioEl = null;     // an MP3 for the song, in place of the YouTube video
  let audioUrl = null;
  let audioSeq = 0;
  // The media for the song is an MP3 (audioEl) or a YouTube video (ytPlayer). These read and drive whichever is in use.
  const media = {
    ready: () => (audioEl ? audioEl.readyState >= 1 : !!(ytPlayer && ytReady)),
    time: () => (audioEl ? audioEl.currentTime : ytPlayer.getCurrentTime()),
    seek: (t) => { if (audioEl) audioEl.currentTime = t; else ytPlayer.seekTo(t, true); },
    playing: () => (audioEl ? !audioEl.paused : !!(ytPlayer && ytReady && ytPlayer.getPlayerState() === 1)),
    rate: (v) => { if (audioEl) audioEl.playbackRate = v; else if (ytPlayer && ytReady) ytPlayer.setPlaybackRate(v); }
  };
  const mediaKey = (n) => (n ? `${n.youtubeUrl || ''}|${n.audio ? n.audio.name + (n.audio.fileId || '') : ''}` : '');

  let ytApi = null;
  let minis = [];       // small alphaTab renderers inside the cards
  let drawSeq = 0;
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
  // Which alphaTab engine draws the tabs: 'html5' (canvas, default) or 'svg'. ?engine=svg switches back, ?engine=html5 returns; kept on this device.
  const renderEngine = (() => {
    try {
      const q = new URLSearchParams(location.search).get('engine');
      if (q === 'svg' || q === 'html5') localStorage.setItem('setcards:engine', q);
      const chosen = localStorage.getItem('setcards:engine');
      return chosen === 'svg' ? 'svg' : 'html5';
    } catch (e) { return 'html5'; }
  })();

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
    // the same checks the notes tool makes: a problem is logged, and the notes are still saved
    const problems = SM.notes.validate(notes);
    if (problems.length) console.warn('Song notes need a look:', problems.join('; '));
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
    // the header shows only the artist; the band, status, key and tempo are in the song's details
    els.songMeta.textContent = state.song.artist || '';
  }

  function updateBanner() {
    const s = state.song;
    const msgs = [];
    if (s && s.offline) msgs.push('Offline: this is the copy saved on this phone. Changes are kept here and sent to the band when you’re back online.');
    else if (s && s.localOnly) msgs.push('Your changes to this song are saved in this browser only. Add the song to a band folder to share them.');
    if (s && state.score && state.partMissing) msgs.push(missingPartText());
    // notices sit behind a button in the top bar, so they never move the tab while it is played
    els.noticeBtn.hidden = !msgs.length;
    els.noticeText.textContent = msgs.join(' ');
    if (!msgs.length) closeDialog(els.noticeDlg);
  }
  els.noticeBtn.addEventListener('click', () => els.noticeDlg.showModal());
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
  // The capo fret for this song (0 for none), kept with the song so the band sees it. It changes only the chord names shown.
  const capoOf = () => (state.notes && Number(state.notes.capo)) || 0;

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
  // With a capo, the names are the shapes to play: a capo at 2 shows the chord a tone below what sounds.
  function chordsAt(bar) {
    const own = state.notes && state.notes.chords && state.notes.chords[bar];
    const sounding = own != null
      ? (own === '-' ? [] : SM.chords.split(own).map((c) => SM.chords.transposeName(c, transposeSemis())))
      : (state.fileChords[bar] || []).map((c) => c.name);
    return sounding.map((c) => SM.chords.shapeOf(c, capoOf()));
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
  const SL = SM.songLogic;
  const riffBars = (riffId, offset) => SL.barsOfRiff(state.parts, riffId, offset);
  // The bars of the written section that holds this bar, from its start to the next section's start.
  const sectionBarRange = (bar) => SL.sectionRange(sortedSections().map((s) => s.start), bar, state.score ? state.score.masterBars.length : 0);
  // The repeats of a riff inside the section of the given bar only (the single-bar and riff dialogs copy to these).
  const riffBarsInSection = (riffId, offset, bar) => {
    const starts = sortedSections().map((s) => s.start);
    return SL.barsOfRiffInSection(state.parts, starts, state.score ? state.score.masterBars.length : 0, riffId, offset, bar);
  };
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
      // a part with no notes is drawn as a gap, unless its chords are shown: then it has a card, and a solid chip
      t.classList.toggle('rest', !!p.empty && !role().cues && !showChords());
      // the chart shows one letter and the bar count for each part, to fit the whole song on the screen
      t.textContent = prefs.view === 'chart' ? `${p.label[0].toUpperCase()} ${p.bars}` : p.label;
      t.title = `${p.label} · ${plural(p.bars, 'bar')} · bars ${p.start + 1}–${p.end + 1}${p.empty ? ' · nothing to play' : ` · ${p.summary}`}`;
      t.addEventListener('click', () => {
        if (prefs.view === 'cards') { scrollToCard(i); playFromPart(i); }
        else if (prefs.view === 'chart') {
          const c = els.chart.querySelector(`.card[data-group="${CSS.escape(p.group.key)}"]`);
          if (c) c.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
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
      // mark the parts on screen once the smooth scroll has finished (scrollend, or a long enough wait where it is not supported)
      els.cards.addEventListener('scrollend', () => markInView(), { once: true });
      clearTimeout(markInView.t);
      markInView.t = setTimeout(markInView, 1500);
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
    const playingGroup = state.playingPart >= 0 && state.parts[state.playingPart] ? state.parts[state.playingPart].group.key : null;
    els.cards.querySelectorAll('.card').forEach((c) => c.classList.toggle('playing', !!playingGroup && c.dataset.group === playingGroup));
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
  // The whole-song note, with the capo beside it: the capo shows the chord shapes, so it is chosen where the cards are.
  function songNoteRow() {
    const row = document.createElement('div');
    row.className = 'song-note-row';
    row.appendChild(noteBlock(null));
    return row;
  }
  // the capo is set in the song settings; only the chord names change, so the tab and the rest of the song stay as they are
  function setCapo(fret) {
    if (fret) state.notes.capo = fret; else delete state.notes.capo;
    saveNotes();
    applyAnnotations();
    updateChartStatus();
    if (prefs.view === 'tab') api.render(); else redrawCards();
  }
  // the chart shows the capo and the chord diagrams setting as text under the title, for guitar
  function updateChartStatus() {
    const show = prefs.view === 'chart' && !!state.score && !!role().diagrams;
    els.chartStatus.hidden = !show;
    if (show) els.chartStatus.textContent = `${capoOf() ? `Capo ${capoOf()}` : 'No capo'} · Chord diagrams ${showChords() ? 'on' : 'off'}`;
  }
  // a chord as its root and a subscript quality, so Gmaj7 and Am take the width of one letter
  const chordHtml = (text) => text.split(' ').map((t) => { const m = t.match(/^([A-G][#b]?)(.+)$/); return m ? `${esc(m[1])}<sub>${esc(m[2])}</sub>` : esc(t); }).join(' ');
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
    if (editRefused()) return;
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

  // A stable fingerprint of the file's contents, so a changed file never shows parts drawn from the old one.
  function fingerprint(data) {
    const view = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    let h = 0x811c9dc5;
    for (let i = 0; i < view.length; i++) h = Math.imul(h ^ (typeof view === 'string' ? view.charCodeAt(i) : view[i]), 0x01000193);
    return `${(h >>> 0).toString(16)}:${view.length}`;
  }

  // Parts drawn on the canvas engine are kept on this device as images, so reopening a song shows them without drawing again.
  const partCache = (() => {
    let db = null;
    const hasIdb = () => typeof indexedDB !== 'undefined';
    const open = () => db || (db = new Promise((res, rej) => {
      const r = indexedDB.open('setcards-parts', 1);
      r.onupgradeneeded = () => { const st = r.result.createObjectStore('parts', { keyPath: 'k' }); st.createIndex('song', 'song'); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
    const run = (mode, fn) => open().then((d) => new Promise((res, rej) => {
      const t = d.transaction('parts', mode);
      const req = fn(t.objectStore('parts'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
    }));
    return {
      get: (k) => (hasIdb() ? run('readonly', (st) => st.get(k)) : Promise.resolve(null)),
      put: (rec) => (hasIdb() ? run('readwrite', (st) => st.put(rec)) : Promise.resolve()),
      // parts drawn from an older copy of the song's file are no longer used
      prune: (song, fileHash) => (hasIdb() ? open().then((d) => new Promise((res, rej) => {
        const t = d.transaction('parts', 'readwrite');
        const req = t.objectStore('parts').index('song').openCursor(IDBKeyRange.only(song));
        req.onsuccess = () => { const c = req.result; if (!c) return; if (c.value.fileHash !== fileHash || c.value.v !== 3) c.delete(); c.continue(); };
        t.oncomplete = () => res();
        t.onerror = () => rej(t.error);
      })) : Promise.resolve())
    };
  })();

  // What the part's tab is drawn with. A part drawn with the same settings, song file and colours can be reused.
  function partKey(display) {
    const cs = getComputedStyle(document.documentElement);
    const colours = ['--ink', '--muted', '--surface'].map((v) => cs.getPropertyValue(v).trim()).join();
    return ['v3', state.song.key, state.source.hash, transposeSemis(), capoOf(), state.trackIndex, colours, JSON.stringify(display)].join('|');
  }

  // The settings a part is drawn with, from its size on the card.
  function miniDisplay(el) {
    const len = Number(el.dataset.len);
    const start = Number(el.dataset.start);
    const width = el.clientWidth || els.cards.clientWidth;
    const perRow = barsPerRow(width, len, start);
    return {
      scale: prefs.zoom * (isPaged() ? 0.72 : isCompact() ? 0.7 : 0.85),
      staveProfile: STAVES[prefs.stave] ?? AT.StaveProfile.Tab,
      startBar: start + 1, barCount: len, barsPerRow: perRow,
      // a phrase of 8 or more bars that fills its rows is stretched across the card; a short riff keeps its natural width,
      // so three bars are not stretched into the width of eight
      justifyLastSystem: len >= 8 && len % perRow === 0
    };
  }

  // alphaTab's "rendered by alphaTab" line is the small system at the end of a part; the cards leave it out
  function creditLine(el) {
    const kids = el.querySelectorAll('.at-surface > div');
    const last = kids[kids.length - 1];
    return last && last.offsetHeight <= 12 ? last : null;
  }

  // The drawn part as its canvases, one image per system, with the sizes and positions it was laid out at,
  // so it can be put back on the card without alphaTab.
  function snapshotMini(el) {
    const surface = el.querySelector('.at-surface');
    if (!surface || !surface.offsetWidth) return null;
    const box = (n) => `left:${n.offsetLeft}px;top:${n.offsetTop}px;width:${n.offsetWidth}px;height:${n.offsetHeight}px`;
    const credit = creditLine(el);
    const systems = [...surface.children].filter((div) => div !== credit).map((div) => {
      const c = div.querySelector('canvas');
      if (!c) return { box: box(div), html: div.outerHTML };
      return { box: box(div), src: c.toDataURL('image/png'), w: c.offsetWidth, h: c.offsetHeight };
    });
    return { size: `width:${surface.offsetWidth}px;height:${surface.offsetHeight}px`, systems };
  }

  function restoreMini(el, snap) {
    el.textContent = '';
    const surface = document.createElement('div');
    surface.className = 'at-surface at';
    surface.setAttribute('style', `position:relative;overflow:hidden;line-height:0;font-size:0px;${snap.size}`);
    snap.systems.forEach((s) => {
      const div = document.createElement('div');
      div.setAttribute('style', `position:absolute;display:inline-block;z-index:1;${s.box}`);
      if (s.src) {
        const img = new Image();
        img.src = s.src;
        img.setAttribute('style', `width:${s.w}px;height:${s.h}px`);
        div.appendChild(img);
      } else {
        div.innerHTML = s.html;
      }
      surface.appendChild(div);
    });
    el.appendChild(surface);
  }

  function startMinis() {
    lastFit = barsPerRow(els.cards.clientWidth, 8, null);
    const holders = [...els.cards.querySelectorAll('.mini-tab')];
    if (!holders.length) return;
    // A part's tab is drawn while it is near the screen and released when it scrolls away, so a long song never
    // holds every drawing in memory (an older iPad runs out of memory and crashes with them all open).
    // Runs once a part's tab is on its card, whether it was restored from the device's copy or drawn.
    const settled = (el) => {
      el.style.minHeight = '';
      // the card is its full height now, which can move the parts after it on to the next screen;
      // a part just picked from the song order is kept in view
      const picked = pagedTarget && isPaged() && els.cards.querySelector(`.card[data-group="${CSS.escape(pagedTarget)}"]`);
      if (picked) els.cards.scrollLeft = picked.offsetLeft - els.cards.offsetLeft;
      clearTimeout(markInView.t);
      markInView.t = setTimeout(markInView, 80);
      el.querySelectorAll('svg').forEach((svg) => { if (svg.querySelectorAll('text').length === 1 && /alphaTab/.test(svg.textContent)) svg.parentElement.style.display = 'none'; });
    };
    const drawMini = (el, display, base) => {
      const mini = new AT.AlphaTabApi(el, {
        core: { fontDirectory: 'lib/font/', engine: renderEngine, logLevel: 'error', useWorkers: false, enableLazyLoading: false },
        display: Object.assign({ layoutMode: AT.LayoutMode.Page }, display),
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
      let kept = false;
      mini.renderFinished.on(() => {
        settled(el);
        if (!kept && renderEngine === 'html5') {
          kept = true;
          // alphaTab sets the size of the part a moment after it reports the render finished
          setTimeout(() => {
            if (el._mini !== mini) return;
            const credit = creditLine(el);
            if (credit) credit.style.display = 'none';
            const snap = snapshotMini(el);
            if (snap) partCache.put(Object.assign({ snap, v: 3 }, base)).catch(() => {});
          }, 200);
        }
      });
      mini.renderScore(state.score, [state.trackIndex]);
      el._mini = mini;
      minis.push(mini);
    };
    // A part's tab is drawn while it is near the screen and released when it scrolls away, so a long song never
    // holds every drawing in memory (an older iPad runs out of memory and crashes with them all open).
    const draw = (el) => {
      if (el.dataset.drawn) return;
      const token = el.dataset.drawn = String(++drawSeq);
      const display = miniDisplay(el);
      const base = { k: partKey(display), song: state.song.key, fileHash: state.source.hash };
      const cached = renderEngine === 'html5' ? partCache.get(base.k).catch(() => null) : Promise.resolve(null);
      cached.then((rec) => {
        if (el.dataset.drawn !== token || !el.isConnected) return;   // released or replaced meanwhile
        if (rec) { restoreMini(el, rec.snap); settled(el); return; }
        drawMini(el, display, base);
      });
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

  // The card view (each section as a card, and the song order): see js/cards.js
  const cardsView = SM.cards.create({
    SM, els, state, role, showChords, showTabInCards, isCompact, isPaged, compactClass, applyPaged, markInView,
    destroyMinis, startMinis, songKeysBlock, songNoteRow, noteBlock, getNote, sectionBarRange, chordsAt, songChordNames,
    riffForBar, openChordDialog, playRange, plural, esc, segColor, selectView, setView,
  });
  const renderCards = cardsView.renderCards;

  /* ---------------- views ---------------- */
  // The full tab follows the playing bar. The cards share alphaTab's scroller, so there only the person scrolls.
  const followScroll = () => { if (api.settings) api.settings.player.scrollMode = prefs.view === 'tab' ? AT.ScrollMode.Continuous : AT.ScrollMode.Off; };
  function setView(v) {
    if (v === prefs.view) return;
    prefs.view = v;
    // the display mode is remembered for each song, on this device only
    if (state.song) prefs.viewBySong[state.song.key] = v;
    savePrefs();
    followScroll();
    applyViewChrome();
    if (v === 'tab') {
      destroyMinis();
      els.cards.innerHTML = '';
      applySimileMarks();
      api.render();
    } else {
      redrawCards();
      els.scroller.scrollTop = 0;
    }
    refreshChipStates();
  }

  // The chart and the cards are both drawn from the song's sections; the full tab is drawn by alphaTab.
  const showingCards = () => prefs.view === 'cards' || prefs.view === 'chart';
  function redrawCards() {
    if (prefs.view === 'chart') renderChart(); else renderCards();
  }

  function applyViewChrome() {
    applyPaged();
    if (state.score) renderMap();
    const cards = prefs.view === 'cards';
    const chart = prefs.view === 'chart';
    const tab = prefs.view === 'tab';
    els.viewSelTop.value = prefs.view;
    els.viewSelSet.value = prefs.view;
    els.cards.hidden = !cards;
    els.chart.hidden = !chart;
    els.tab.hidden = !tab;
    els.sectionHead.hidden = !tab;
    compactClass();
    if (!chart && !els.chartEditor.hidden) closeChartEditor();
    if ((cards || chart) && state.editing) setEditing(false);
    document.body.classList.toggle('chart-view', chart);
    if (!chart) document.body.classList.remove('player-open');
    updateChartStatus();
  }

  // The chart: one card per section, a cell for each bar, and a lyric cue line for each time the section is sung. It is
  // the song's own chart (notes.chart, and the song's chords for guitar): nothing shows until it is entered.
  const chartNotes = () => (state.notes && state.notes.chart) || {};
  // What a bar holds, for the chart: its bass note, or for guitar its sounding chord, and its tags.
  function chartCellInfo(bar) {
    const c = chartNotes();
    const tags = (c.tags && c.tags[bar]) || [];
    if (role().diagrams) {
      const raw = state.notes && state.notes.chords && state.notes.chords[bar];
      if (raw === '-') return { rest: true, tags };
      return { text: chordsAt(bar).map((n) => SM.chords.soundingOf(n, capoOf())).join(' '), tags };
    }
    const n = (c.notes && c.notes[bar]) || '';
    if (n === '-' || tags.includes('Rest')) return { rest: true, tags };
    return { text: n, tags };
  }
  const chartCueFor = (key) => chartNotes().cues?.[key] || '';
  const REST_ICON = '<svg viewBox="0 0 12 14" width="12" height="14" aria-hidden="true" style="display:block;margin:auto"><path d="M0 3h12" stroke="currentColor" stroke-width="1"></path><rect x="2" y="3" width="8" height="4" fill="currentColor"></rect></svg>';
  function renderChart() {
    const box = els.chart;
    box.innerHTML = '';
    updateChartStatus();
    if (!state.score || !state.groups.length) return;
    // the guitar row (capo and the chord diagrams toggle) at the top, as in the cards
    box.appendChild(songNoteRow());
    // the chord diagrams, above the chart, when they are shown for this instrument
    if (role().diagrams && showChords()) {
      const names = songChordNames();
      if (names.length) {
        const strip = document.createElement('section');
        strip.className = 'card chart-card diagram-strip';
        strip.innerHTML = `<h3 class="card-label">Chords in this song</h3><div class="diagrams">${names.map((n) => SM.chords.diagram(n)).join('')}</div>`;
        box.appendChild(strip);
      }
    }
    SM.chart.chartSections({ groups: state.groups, parts: state.parts, cellFor: chartCellInfo, cueFor: chartCueFor }).forEach((sec) => {
      const group = state.groups.find((g) => g.key === sec.group);
      const card = document.createElement('section');
      card.className = 'card chart-card';
      card.dataset.group = sec.group;
      card.style.setProperty('--seg', segColor(group ? group.kind : ''));
      // the section name sits above its bars, which then have the full width of the card
      const name = document.createElement('div');
      name.className = 'chart-name';
      name.textContent = sec.name;
      card.appendChild(name);
      const cells = document.createElement('div');
      cells.className = 'chart-cells';
      cells.style.setProperty('--cols', String(Math.min(9, sec.cells.length)));
      sec.cells.forEach((c) => {
        // each bar is a button: a tap opens the bar (see attachBarPress)
        const d = document.createElement('button');
        d.type = 'button';
        d.className = 'chart-cell' + (c.kind === 'empty' ? ' empty' : c.kind === 'stab' ? ' stab' : c.kind === 'slide' ? ' slide' : c.kind === 'rest' ? ' rest' : '');
        d.setAttribute('aria-label', `Bar ${c.bar + 1}${c.kind === 'rest' ? ', rest' : c.text ? `, ${c.text}` : ''}`);
        if (c.kind === 'rest') d.innerHTML = REST_ICON; else if (role().diagrams) d.innerHTML = chordHtml(c.text); else d.textContent = c.text;
        attachBarPress(d, c.bar);
        cells.appendChild(d);
      });
      const lines = document.createElement('div');
      lines.className = 'card-lines';
      sec.lines.forEach((line) => {
        const row = document.createElement('div');
        row.className = 'layout';
        const when = document.createElement('span');
        when.className = 'when';
        when.textContent = line.label;
        const cue = document.createElement('span');
        cue.className = 'cue-text';
        cue.textContent = line.cue;
        row.appendChild(when);
        row.appendChild(cue);
        lines.appendChild(row);
      });
      card.appendChild(cells);
      card.appendChild(lines);
      box.appendChild(card);
    });
  }

  // Scrolls the full tab to a bar once it has been drawn.
  let pendingTabBar = null;
  function scrollTabToBar(bar) {
    const mb = api.boundsLookup && api.boundsLookup.findMasterBarByIndex(bar);
    if (!mb) return;
    els.scroller.scrollTop = Math.max(0, els.tab.offsetTop + mb.visualBounds.y - 8);
  }
  function selectView(index, opts = {}) {
    if (!state.score) return;
    index = Math.max(-1, Math.min(state.parts.length - 1, index));
    state.view = index;
    refreshChipStates();
    updateHeader();
    // the full tab always shows every bar; a picked part is scrolled to, not cut out of the tab
    const d = api.settings.display;
    d.startBar = 1;
    d.barCount = -1;
    api.updateSettings();
    pendingTabBar = index >= 0 ? state.parts[index].start : -1;
    if (prefs.view !== 'tab') els.scroller.scrollTop = 0;   // the cards start each part at the top
    api.render();
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
    api.isLooping = false;
    api.tickPosition = range.startTick;
  }

  // In the cards view, a section picked in the song order is where playback starts: it begins again there if playing,
  // and otherwise Play starts from there.
  function playFromPart(i) {
    const p = state.parts[i];
    if (!p || !state.score) return;
    const range = new AT.synth.PlaybackRange();
    range.startTick = p.playStart;
    range.endTick = p.playEnd;
    const wasPlaying = state.playing;
    if (wasPlaying) api.stop();
    api.playbackRange = range;
    api.isLooping = false;
    api.tickPosition = range.startTick;
    if (wasPlaying) api.play();
  }
  // Lets the browser tests read the playback position. Only present when a test browser is driving the page.
  if (navigator.webdriver) {
    window.setcardsTest = {
      state: () => ({
        tick: api.tickPosition,
        playing: state.playing,
        range: api.playbackRange ? { start: api.playbackRange.startTick, end: api.playbackRange.endTick } : null,
        parts: state.parts.map((p) => ({ start: p.playStart, end: p.playEnd })),
        bars: state.score ? state.score.masterBars.slice(0, 12).map((m) => m.start) : [],
        sideSticks: click.clickCount(),
        scroll: els.scroller ? els.scroller.scrollTop : 0,
        metronome: api.metronomeVolume,
        groups: state.groups ? state.groups.length : 0,
        simileBars: state.score && state.score.tracks[state.trackIndex] ? state.score.tracks[state.trackIndex].staves[0].bars.filter((b) => b.simileMark).length : 0
      })
    };
  }
  function playRange(start, end) {
    if (els.playBtn.disabled) { toast(soundProblem || 'Sounds are still loading'); return; }
    const range = rangeFor(start, end);
    api.stop();
    api.playbackRange = range;
    api.isLooping = false;
    api.tickPosition = range.startTick;
    api.play();
  }

  /* ---------------- alphaTab ---------------- */
  const api = new AT.AlphaTabApi(els.tab, {
    core: { fontDirectory: 'lib/font/', engine: renderEngine, logLevel: 'warning', includeNoteBounds: true },
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
    if (state.score) { if (prefs.view === 'tab') api.render(); else redrawCards(); }
  };
  if (themeQuery.addEventListener) themeQuery.addEventListener('change', onTheme);
  new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  api.scoreLoaded.on((score) => {
    state.score = score;
    feelApplied = null;   // a new score has its own timing, so the drum feel is applied again
    applyClick();
    applySimileMarks();
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
    els.drumsBtn.hidden = !drumTrack();
    applyDrumKit();
    setDrumsOnly(prefs.drumsOnly);
    if (showingCards()) { redrawCards(); doneSwitching(); }
    if (suggested) toast(`This file had no sections, so Setcards suggested ${state.notes.sections.length}. Rename them in Edit.`);
  });

  api.renderStarted.on(() => { els.loading.hidden = false; });
  api.renderFinished.on(() => {
    els.loading.hidden = true;
    doneSwitching();
    if (pendingTabBar !== null && prefs.view === 'tab') {
      if (pendingTabBar < 0) els.scroller.scrollTop = 0; else scrollTabToBar(pendingTabBar);
      pendingTabBar = null;
    }
    drawSelection();
    // alphaTab's credit line is shown in the play bar instead, so it is left out of the tab (set once the size is settled)
    setTimeout(() => { const credit = creditLine(els.tab); if (credit) credit.style.display = 'none'; }, 200);
  });
  // alphaTab draws its tab into the page after it reports a render, so the numbers are marked as they appear
  [els.tab, els.cards].forEach((box) => new MutationObserver(() => addNumberHalos(box)).observe(box, { childList: true, subtree: true }));
  api.error.on((e) => {
    els.loading.hidden = true;
    logSound(`error: ${e && (e.message || e.name || e)}`);
    console.error(e);
    toast('That file could not be read. Try exporting it again from Guitar Pro.');
  });
  // A short record of what the sound does on this device, shown in Song settings so a fault can be reported with it.
  const soundLog = [];
  const logSound = (what) => {
    soundLog.push(`${new Date().toLocaleTimeString()} ${what}`);
    if (soundLog.length > 60) soundLog.shift();
    els.soundLogText.textContent = soundLog.join('\n');
  };
  const shownVersion = String(window.SETCARDS_VERSION || '');
  els.appVersion.textContent = `Setcards version ${shownVersion.startsWith('__') ? 'in development' : shownVersion}`;
  logSound(`device: ${navigator.userAgent.replace(/^.*?\((.*?)\).*$/, '$1')}`);
  logSound(`audio: ${window.AudioContext ? 'AudioContext' : (window.webkitAudioContext ? 'webkitAudioContext' : 'none')}`);
  fetch('lib/soundfont/sonivox.sf2', { method: 'HEAD' })
    .then((r) => logSound(`sound file: status ${r.status}, ${r.headers.get('content-length') || 'unknown'} bytes`))
    .catch((e) => logSound(`sound file: could not be checked (${e.message})`));
  // Why sound is not available is shown, so a missing synthesizer does not fail silently.
  let soundProblem = (window.AudioContext || window.webkitAudioContext) ? null : 'This browser has no audio support, so there is no playback.';
  const reportSound = (reason) => {
    soundProblem = reason;
    console.warn('Setcards sound:', reason);
    els.playerStatus.textContent = reason;
  };
  if (soundProblem) reportSound(soundProblem);
  let lastLoadLogged = -1;
  api.soundFontLoad.on((e) => {
    if (!e.total) return;
    const pct = Math.round((e.loaded / e.total) * 100);
    els.playerStatus.textContent = `Loading sounds ${pct}%`;
    if (pct >= lastLoadLogged + 25 || pct === 100) { lastLoadLogged = pct; logSound(`sound font loading ${pct}%`); }
  });
  // alphaTab does not report a failed sound load to the page, so a long wait is named instead
  let soundReady = false;
  setTimeout(() => { if (!soundReady && !soundProblem) { logSound('no sound ready after 20 seconds'); reportSound('The sounds have not loaded after 20 seconds, so playback may be off on this device.'); } }, 20000);
  // alphaTab's audio context, found in its player. On iPads it starts suspended and only runs after a tap.
  function audioContext() {
    const seen = new Set();
    const find = (o, depth) => {
      if (!o || typeof o !== 'object' || seen.has(o) || depth > 4) return null;
      seen.add(o);
      if ('state' in o && 'sampleRate' in o && typeof o.resume === 'function') return o;
      for (const k of Object.keys(o)) {
        let v;
        try { v = o[k]; } catch (e) { continue; }
        if (v && typeof v === 'object' && !(v instanceof Element)) { const f = find(v, depth + 1); if (f) return f; }
      }
      return null;
    };
    try { return find(api.player, 0); } catch (e) { return null; }
  }
  // Starts the audio if the browser has it suspended (it has to be started from a tap).
  function unlockAudio() {
    const ctx = audioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      logSound('audio was suspended: resuming it');
      ctx.resume().then(() => logSound(`audio ${ctx.state}`)).catch((e) => logSound(`audio could not resume: ${e.message}`));
    }
  }
  api.playerReady.on(() => {
    logSound('player ready');
    const ctx = audioContext();
    logSound(`audio ${ctx ? ctx.state : 'context not found'}`);
    if (api.player && api.player.soundFontLoaded && api.player.soundFontLoadFailed) {
      api.player.soundFontLoaded.on(() => logSound('sound font loaded'));
      api.player.soundFontLoadFailed.on((e) => logSound(`sound font FAILED: ${e && (e.message || e)}`));
    }
    soundReady = true;
    soundProblem = null;
    els.playBtn.disabled = false;
    els.playerStatus.textContent = '';
  });
  // Keeps the screen on while a song plays, so the sound does not glitch when the screen would go off.
  // Where the browser has no wake lock (iOS 12 and older), this does nothing.
  let wakeLock = null;
  async function keepScreenOn(on) {
    if (!('wakeLock' in navigator)) return;
    try {
      if (on && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!on && wakeLock) {
        const lock = wakeLock;
        wakeLock = null;
        await lock.release();
      }
    } catch (e) { wakeLock = null; }
  }
  // the browser releases the lock when the app is hidden, so it is asked for again when the app comes back
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && state.playing) keepScreenOn(true); });
  api.playerStateChanged.on((e) => {
    logSound(`player ${e.state === 1 ? 'playing' : 'stopped'}`);
    keepScreenOn(e.state === 1);
    state.playing = e.state === 1;
    els.playBtn.classList.toggle('is-playing', state.playing);
    els.playBtn.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
    if (!state.playing && !media.ready()) setPlayingPart(-1);
  });
  api.playerPositionChanged.on((e) => {
    if (!state.score || !state.playing) return;
    setPlayingPart(partIndexForTick(e.currentTick));
    updateClick();
  });

  // Count-in and click, set for each song. The click plays only in bars where the drums have no notes, so a song
  // whose drums come in late keeps its time without the click sitting on top of the drums.
  // The click and the count-in: see js/click.js. The side sticks are the click in drum-free bars.
  // the display-only changes to the score, taken out while a file is written (see js/overlays.js)
  const overlays = SM.overlays.create();
  const click = SM.click.create({ api, AT, notes: () => state.notes, score: () => state.score, prefs: () => prefs,
    listening: () => chordPanel.isListening(), drumTrack: () => drumTrack(), overlays });
  const { clickSetup, clickLevel, countInLevel, computeClickBars, updateClick, applyClick, syncClickNotes } = click;
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
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const target = noteEditBlock() ? null : editTargetAt(x, y);
    if (target) {
      state.edit.sel = target;
      state.edit.typing = null;
      drawSelection();
      return;
    }
    const beat = api.boundsLookup.getBeatAtPos(x, y);
    if (beat) openBarDialog(beat.voice.bar.index);
    if (beat && noteEditBlock()) toast(noteEditBlock());
  });

  /* ---------------- notes edited in the full tab (desktop) ---------------- */
  // The changes are kept as steps and shown on the tab straight away. Save writes them into the file, which is read again.
  const EDIT_FRET_MAX = 24;
  state.edit = { ops: [], sel: null, typing: null };
  const newNote = (beat, string) => {
    const n = new AT.model.Note();
    n.beat = beat;
    n.string = string;
    n.fret = 0;
    n.isDead = false;
    n.isStringed = true;
    return n;
  };
  // Why notes cannot be edited here, or null when they can.
  function noteEditBlock() {
    if (!state.song || !state.song.hasTab || !state.source || state.source.tex || !state.source.bytes) return 'Notes can only be edited in a Guitar Pro or MusicXML file.';
    if (transposeSemis()) return 'Set the key back to the file’s key to edit notes, so the saved file keeps its notes.';
    if (!SM.library.parse(state.song.key).source.replaceTab) return 'This copy of the song is read-only here.';
    return null;
  }
  // Where the strings of the staff are, worked out from the note heads drawn on it (at least two strings are needed).
  function staffLines(bb) {
    const sys = api.boundsLookup.staffSystems.find((x) => x.bars.some((mb) => mb.bars.some((sb) => sb.beats.includes(bb))));
    if (!sys) return null;
    const pts = [];
    sys.bars.forEach((mb) => mb.bars.forEach((sb) => sb.beats.forEach((b) => (b.notes || []).forEach((nb) => {
      pts.push({ s: nb.note.string, y: nb.noteHeadBounds.y + nb.noteHeadBounds.h / 2 });
    }))));
    if (new Set(pts.map((p) => p.s)).size < 2) return null;
    const n = pts.length;
    const ms = pts.reduce((a, p) => a + p.s, 0) / n;
    const my = pts.reduce((a, p) => a + p.y, 0) / n;
    const slope = pts.reduce((a, p) => a + (p.s - ms) * (p.y - my), 0) / pts.reduce((a, p) => a + (p.s - ms) ** 2, 0);
    const base = my - slope * ms;
    return { yOf: (s) => base + slope * s, stringAt: (y) => Math.round((y - base) / slope) };
  }
  // The note under the click, or the string nearest the click on the beat it is in.
  function editTargetAt(x, y) {
    const bl = api.boundsLookup;
    const beat = bl.getBeatAtPos(x, y);
    if (!beat) return null;
    const key = SM.noteEdit.beatKey(beat);
    const onNote = bl.getNoteAtPos(beat, x, y);
    if (onNote) return { key, beat, string: onNote.string, note: onNote };
    const bb = (bl.findBeats(beat) || [])[0];
    const lines = bb && staffLines(bb);
    if (!lines) return null;
    const strings = state.score.tracks[state.trackIndex].staves[0].tuning.length;
    const spacing = Math.abs(lines.yOf(2) - lines.yOf(1)) || 1;
    if (y < lines.yOf(1) - spacing / 2 || y > lines.yOf(strings) + spacing / 2) return null;
    const string = Math.min(strings, Math.max(1, lines.stringAt(y)));
    return { key, beat, string, note: beat.notes.find((n) => n.string === string) || null };
  }
  // The box around the selected note, or the place where a note would go.
  function selectionRect(sel) {
    const bl = api.boundsLookup;
    const bb = (bl.findBeats(sel.beat) || [])[0];
    if (!bb) return null;
    const nb = sel.note && (bb.notes || []).find((x) => x.note === sel.note);
    if (nb) return { x: nb.noteHeadBounds.x, y: nb.noteHeadBounds.y, w: nb.noteHeadBounds.w, h: nb.noteHeadBounds.h };
    const lines = staffLines(bb);
    const vb = bb.visualBounds;
    if (!lines || !vb) return null;
    const h = Math.abs(lines.yOf(2) - lines.yOf(1)) * 0.8;
    return { x: vb.x, y: lines.yOf(sel.string) - h / 2, w: vb.w, h };
  }
  function drawSelection() {
    const surface = els.tab.querySelector('.at-surface');
    if (!surface) return;
    surface.querySelectorAll('.note-sel').forEach((el) => el.remove());
    const sel = state.edit.sel;
    if (!state.editing || !sel) return;
    const rect = selectionRect(sel);
    if (!rect) return;
    const box = document.createElement('div');
    box.className = 'note-sel';
    box.style.cssText = `left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px`;
    surface.appendChild(box);
  }
  function updateNoteBar() {
    const n = state.edit.ops.length;
    els.noteEditBar.hidden = !n;
    els.noteEditCount.textContent = `${n} unsaved ${n === 1 ? 'change' : 'changes'} to the notes`;
  }
  // Shows the change on the tab, and records it.
  function recordStep(op, continuing) {
    const ops = state.edit.ops;
    const last = ops[ops.length - 1];
    if (continuing && last && last.op === 'set' && op.op === 'set' && last.beat === op.beat && last.string === op.string) last.fret = op.fret;
    else ops.push(op);
    SM.noteEdit.applyOps(state.score, state.trackIndex, [op], newNote);
    refreshEdited();
  }
  function refreshEdited() {
    updateNoteBar();
    api.render();
  }
  function typeDigit(d) {
    const sel = state.edit.sel;
    if (!sel) { toast('Click a string in a bar first, then type the fret number'); return; }
    const t = state.edit.typing;
    const continuing = !!t && t.key === sel.key && t.string === sel.string && Date.now() - t.at < 1200;
    const typed = continuing ? Number(t.buffer + d) : Number(d);
    const fret = typed <= EDIT_FRET_MAX ? typed : Number(d);
    state.edit.typing = { key: sel.key, string: sel.string, buffer: String(fret), at: Date.now() };
    recordStep({ op: 'set', beat: sel.key, string: sel.string, fret }, continuing);
    sel.note = sel.beat.notes.find((n) => n.string === sel.string) || null;
    drawSelection();
  }
  function deleteSelected() {
    const sel = state.edit.sel;
    if (!sel || !sel.note) return;
    recordStep({ op: 'delete', beat: sel.key, string: sel.string }, false);
    state.edit.typing = null;
    sel.note = null;
    drawSelection();
  }
  document.addEventListener('keydown', (e) => {
    if (!state.editing || prefs.view !== 'tab' || els.songView.hidden || document.querySelector('dialog[open]')) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); if (!noteEditBlock()) typeDigit(e.key); else toast(noteEditBlock()); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { if (state.edit.sel && state.edit.sel.note) { e.preventDefault(); deleteSelected(); } }
    else if (e.key === 'Escape') { state.edit.sel = null; state.edit.typing = null; drawSelection(); }
  });
  // Nothing is written until Save; leaving the edit with changes asks first.
  function confirmNoteEdits() {
    return !state.edit.ops.length || confirm('Discard the note changes you have not saved?');
  }
  function discardNoteEdits() {
    state.edit.ops = [];
    state.edit.sel = null;
    state.edit.typing = null;
    updateNoteBar();
    if (state.song && state.source) loadSource();
  }
  async function saveNoteEdits() {
    if (!state.edit.ops.length) return;
    const blocked = noteEditBlock();
    if (blocked) { toast(blocked); return; }
    try {
      const settings = api.settings;
      // the file as it was read, with the changes applied, written out and read back to check it holds exactly those notes
      const score = AT.importer.ScoreLoader.loadScoreFromBytes(state.source.bytes, settings);
      SM.noteEdit.applyOps(score, state.trackIndex, state.edit.ops, newNote);
      const expected = SM.noteEdit.notesText(score, state.trackIndex);
      const bytes = new Uint8Array(new AT.exporter.Gp7Exporter().export(score, settings));
      const check = AT.importer.ScoreLoader.loadScoreFromBytes(bytes, settings);
      const same = check.masterBars.length === score.masterBars.length &&
        JSON.stringify(SM.noteEdit.notesText(check, state.trackIndex)) === JSON.stringify(expected);
      if (!same) { toast('The notes could not be saved safely, so nothing was changed'); return; }
      const { source, id } = SM.library.parse(state.song.key);
      const name = `${(state.song.fileName || 'Song').replace(/\.(gp[345]?|gpx|xml|musicxml|mxl|capx)$/i, '')}.gp`;
      toast('Saving the notes…');
      await source.replaceTab(id, bytes, name);
      state.song.fileName = name;
      state.source = { bytes, tex: null, hash: fingerprint(bytes) };
      state.edit.ops = [];
      state.edit.sel = null;
      state.edit.typing = null;
      updateNoteBar();
      loadSource();
      toast('Notes saved to the file');
    } catch (e) {
      console.error(e);
      toast(e.message || 'The notes could not be saved');
    }
  }
  els.noteSave.addEventListener('click', saveNoteEdits);
  els.noteDiscard.addEventListener('click', discardNoteEdits);

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
    // a track the score does not have cannot be drawn (alphaTab fails on it), so it is ignored
    if (!state.score || !state.score.tracks[i]) { logSound(`track ${i} is not in this song`); return; }
    state.trackIndex = i;
    deriveParts();
    applyAnnotations();
    renderMap();
    api.renderTracks([state.score.tracks[i]]);
    if (showingCards()) redrawCards();
    els.trackSel.value = i;
  }

  function setRole(id) {
    prefs.role = id;
    prefs.roleChosen = true;
    savePrefs();
    refreshEditPanel();
    els.roleSel.value = prefs.role;
    els.homeRoleBtn.textContent = role().label;
    if (!state.score) return;
    applySimileMarks();
    const i = pickTrack(state.score);
    updateBanner();
    if (i !== state.trackIndex) useTrack(i);
    else if (showingCards()) redrawCards();
    els.showTabCards.checked = showTabInCards();
    els.showChords.checked = showChords();
    if (applyChordVisibility() && prefs.view === 'tab') api.render();
  }

  function fillRoleSelect() {
    els.roleSel.innerHTML = '';
    ROLES.forEach((r) => { const o = document.createElement('option'); o.value = r.id; o.textContent = r.label; els.roleSel.appendChild(o); });
    els.roleSel.value = prefs.role;
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
  // what you play is chosen in the song settings (and on the home screen)
  fillRoleSelect();
  els.roleSel.addEventListener('change', () => setRole(els.roleSel.value));
  els.homeRoleBtn.addEventListener('click', openRoles);
  // The refresh icon reloads the songs, and looks for a new version of the app: when one is ready, the page reloads onto it.
  // While a dialog is open, a touch outside it does not scroll the page underneath (on older iPads it did).
  document.addEventListener('touchmove', (e) => {
    const open = document.querySelector('dialog[open]');
    if (open && !open.contains(e.target)) e.preventDefault();
  }, { passive: false });
  els.syncBtn.addEventListener('click', () => {
    if (updateWaiting) { refreshForUpdate(); return; }
    if (swRegistration) swRegistration.update().catch(() => {}).then(() => { if (updateWaiting && els.homeView.hidden === false) refreshForUpdate(); });
    if (!syncTasks.has('songs')) renderHome();
  });

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
    els.noticeBtn.hidden = true;
    els.loading.hidden = false;
  }
  const doneSwitching = () => els.songView.classList.remove('switching');

  let opening = null;
  async function openSong(key, title) {
    flushSave();
    opening = key;
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

  /* ---------------- read only until signed in ---------------- */
  // A band song (one in the band folder) can be read by anyone with the app. Editing it needs a sign-in first, so an
  // edit is never kept back to be sent later. Drafts and songs kept on this device can always be edited.
  const isBandSong = (key) => !!key && SM.library.parse(key).sourceId === 'drive';
  const canEditSong = () => !state.song || !isBandSong(state.song.key) || drive.signedIn();
  function editRefused() {
    if (canEditSong()) return false;
    toast('Sign in to Google to edit this band song. You can still read it.');
    return true;
  }
  function syncReadOnly() { document.body.classList.toggle('read-only', !canEditSong()); }

  function applySong(key, song, refresh) {
    const prevVideo = mediaKey(state.notes);
    if (state.playing) api.stop();
    destroyMinis();
    state.song = { key, fileTitle: song.title || (song.fileName || 'Untitled').replace(SM.SONG_EXT, ''), fileArtist: song.artist || '', title: song.notes.title || song.title || (song.fileName || 'Untitled').replace(SM.SONG_EXT, ''), artist: song.notes.artist || song.artist || '', fileName: song.fileName, canShare: song.canShare, localOnly: song.localOnly, offline: !!song.offline };
    state.notes = song.notes;
    state.notes.chords = state.notes.chords || {};
    syncReadOnly();
    // changes kept in this browser while the page was closing are sent on to where the song lives
    if (song.fromOverlay && song.canShare) saveNotes();
    state.score = null;
    state.edit = { ops: [], sel: null, typing: null };
    updateNoteBar();
    state.playingPart = -1;
    prefs.last = key;
    savePrefs();
    els.songTitle.textContent = state.song.title;
    updateSongMeta();
    document.title = `${state.song.title} · Setcards`;
    updateBanner();
    resetDisplay();
    if (state.editing) setEditing(false);
    // this song's own display mode, if it was used before on this device
    if (prefs.viewBySong[key]) prefs.view = prefs.viewBySong[key];
    followScroll();
    applyViewChrome();
    // a song's video is not shown until it is asked for
    if (!refresh) state.videoOn = false;
    if (!refresh || mediaKey(song.notes) !== prevVideo) setupVideo();
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
    state.source = { bytes: song.bytes, tex: song.tex, hash: fingerprint(song.bytes || song.tex) };
    loadSource();
  }

  // Reads the tab again from the copy already downloaded, for example after a change of transposition.
  function loadSource() {
    const key = state.song.key;
    const track = (prefs.tracks[key] && prefs.tracks[key][prefs.role]) || 0;
    if (renderEngine === 'html5') partCache.prune(key, state.source.hash).catch(() => {});
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
    if (score.tracks[state.trackIndex] && api.tracks && api.tracks.length && api.tracks[0] !== score.tracks[state.trackIndex]) {
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
    if (on && editRefused()) return;
    if (!on && !confirmNoteEdits()) return;
    if (!on && state.edit.ops.length) discardNoteEdits();
    state.editing = on;
    document.body.classList.toggle('editing', on);
    els.editBtn.setAttribute('aria-pressed', String(on));
    els.editBtn.querySelector('.edit-word').textContent = on ? 'Done' : 'Edit';
    els.editBtn.setAttribute('aria-label', on ? 'Done' : 'Edit');
    els.editPanel.hidden = !on;
    if (on) {
      if (prefs.view !== 'tab' && !chordPanelMode()) setView('tab');
      renderEditList();
      if (state.view !== -1) selectView(-1);
    }
    refreshEditPanel();
  }

  function sectionsChanged() {
    const prevView = state.view;
    deriveParts();
    applyAnnotations();
    state.view = Math.min(prevView, state.parts.length - 1);
    renderMap();
    renderEditList();
    saveNotes();
    if (prefs.view === 'tab') selectView(state.view, { keepVideo: true }); else redrawCards();
  }

  function chordsChanged() {
    applyAnnotations();
    saveNotes();
    if (prefs.view === 'tab') api.render(); else redrawCards();
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
    const videoReady = media.ready();
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
          s.videoTime = Math.round(media.time() * 10) / 10;
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
    if (editRefused()) return;
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
    const own = state.notes.chords[bar];
    els.barChords.value = own === '-' ? '-' : chordsAt(bar).join(' ');
    els.barChords.dataset.initial = els.barChords.value;
    const times = rf ? riffBarsInSection(rf.riff, rf.offset, bar).length : 1;
    els.barChordsAllLabel.hidden = !(rf && times > 1);
    els.barChordsAll.checked = false;   // only this bar, unless the repeats are asked for
    if (rf) els.barChordsAllLabel.querySelector('span').textContent = `Also in every repeat of riff ${rf.riff} in this section (${times} times)`;
    els.barDlg.showModal();
  }

  function setChords(bar, text, everywhere) {
    const rf = riffForBar(bar);
    const bars = everywhere && rf ? riffBarsInSection(rf.riff, rf.offset, bar) : [bar];
    // entered as the shapes shown (with any capo); stored in the tab's own key
    const value = SM.chords.transposeText(text.trim(), capoOf() - transposeSemis());
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
  els.editBtn.addEventListener('click', () => (prefs.view === 'chart' ? openChartEditor() : setEditing(!state.editing)));
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
    if (editRefused()) return;
    state.chordEdit = { bar, riffId, offset };
    const times = riffBarsInSection(riffId, offset, bar).length;
    els.chordDlgTitle.textContent = `Riff ${riffId}, bar ${offset + 1}`;
    els.chordInput.value = chordsAt(bar).join(' ');
    els.chordAllLabel.hidden = times <= 1;
    els.chordAll.checked = false;   // only this bar, unless the repeats are asked for
    els.chordAllLabel.querySelector('span').textContent = `Also in every repeat of riff ${riffId} in this section (${times} times)`;
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

  // Guitar edit mode: the chord sheet, and listening to a tab part (see js/chordpanel.js)
  function chordPanelMode() { return prefs.role === 'guitar'; }
  const chordPanel = SM.chordPanel.create({
    els, state, api, toast, unlockAudio, updateClick: () => updateClick(), setChords, chordsChanged, chordsAt, capoOf,
    setEditing: (on) => setEditing(on), isGuitar: chordPanelMode,
  });
  function refreshEditPanel() { chordPanel.refresh(state.editing); }
  /* ---------------- repeated bars as % (an experiment: bass, tab view, one section at a time) ---------------- */
  // In a section that is switched on, a bar exactly like the one before it is drawn with a % sign. The notes stay in
  // the score, so playback and the saved file are unchanged; the marks are put back while a file is written.
  const originalSimile = new Map();   // bar -> the mark it came with, for the bars shown with %
  // The % marks were drawn from the "Repeats as %" button, which is removed; the marks are kept switched off.
  const simileOn = () => false;
  const simileStarts = () => (state.notes && state.notes.simile) || [];
  function restoreSimile() {
    originalSimile.forEach((mark, bar) => { bar.simileMark = mark; });
  }
  // the % marks are an overlay too: they are taken out while a file is written
  let simileHidden = null;
  overlays.add({
    hide() { simileHidden = Array.from(originalSimile.keys()).map((bar) => [bar, bar.simileMark]); restoreSimile(); },
    show() { (simileHidden || []).forEach(([bar, mark]) => { bar.simileMark = mark; }); simileHidden = null; },
  });
  function applySimileMarks() {
    if (!state.score) return;
    restoreSimile();
    originalSimile.clear();
    const staff = state.score.tracks[state.trackIndex] && state.score.tracks[state.trackIndex].staves[0];
    if (!staff || !simileOn()) return;
    const same = (a, b) => {
      const ta = SM.analysis.barTokens(state.score, state.trackIndex, a);
      return ta.length > 0 && JSON.stringify(ta) === JSON.stringify(SM.analysis.barTokens(state.score, state.trackIndex, b));
    };
    simileStarts().forEach((start) => {
      const [a, b] = sectionBarRange(start);
      for (let i = a + 1; i <= b; i++) {
        const bar = staff.bars[i];
        if (!bar || !same(i - 1, i)) continue;
        originalSimile.set(bar, bar.simileMark);
        bar.simileMark = AT.model.SimileMark.Simple;
      }
    });
  }
  // the % button on a bass card: that section's repeats are drawn with % on its card
  function toggleSimile(start) {
    if (!state.notes) return;
    const list = simileStarts().slice();
    const i = list.indexOf(start);
    if (i >= 0) list.splice(i, 1); else list.push(start);
    state.notes.simile = list;
    saveNotes();
    renderCards();
  }

  /* ---------------- player controls ---------------- */
  // The drum kit is a SoundFont with its own drum sounds. Each song uses its own kit, or the default one. Kits are
  // read in the background, and the synth takes a kit between songs, never while playing. Until a kit is ready, the
  // built-in drums play. iOS 12 and older (the old iPad) stopped playing once a kit was added, so they keep the built-in synth.
  // Drum kits: see js/kits.js. The built-in drums play on iOS 12 and older, which keep the built-in sounds.
  const DRUM_KIT_URL = 'kits/drums-default.sf2';
  const SYNTH_URL = 'lib/soundfont/sonivox.sf2';
  // iOS 12 and older (the old iPad) crashed after a few bars once the 23 MB kit was loaded, so they keep the built-in drums.
  const oldIos = /(iPad|iPhone|iPod)/.test(navigator.userAgent) && /OS (1[0-2])_/.test(navigator.userAgent);
  const kitMeta = () => (state.notes && state.notes.drumKit) || null;
  // Drum kit playback. Turned off while a silence was being found; set to false to use the built-in drums only.
  const KIT_PLAYBACK = true;
  const kits = SM.kits.create({
    api, library: SM.library, soundfont: SM.soundfont, logSound, toast, drumTrack: () => drumTrack(), kitMeta,
    songKey: () => state.song.key, hasScore: () => !!state.score, fetch: (u) => fetch(u),
    urls: { kit: DRUM_KIT_URL, synth: SYNTH_URL }, oldIos, playback: KIT_PLAYBACK,
  });
  const { applyDrumKit, readKit, kitId } = kits;
  setTimeout(() => { if (KIT_PLAYBACK && !oldIos) readKit(null).catch((e) => console.error(e)); }, 3000);

  els.playBtn.addEventListener('click', () => {
    if (els.playBtn.disabled) { toast(soundProblem || 'Sounds are still loading'); return; }
    unlockAudio();
    if (!state.playing) applyDrumFeel();
    applyDrumKit();
    followScroll();
    if (prefs.view === 'tab' || state.playing) { api.playPause(); return; }
    applyPlaybackRange();
    api.playPause();
  });
  // Back to the beginning: the start of the song, or of the section on screen when one is picked.
  els.skipBtn.addEventListener('click', () => {
    if (!state.score) return;
    const start = state.view >= 0 && state.parts[state.view] ? state.parts[state.view].playStart : 0;
    const wasPlaying = state.playing;
    if (wasPlaying) api.stop();
    api.tickPosition = start;
    if (wasPlaying) api.play();
  });
  // Plays only the drum track, as backing for practice: every other track is silenced while it is on.
  const drumTrack = () => (state.score ? state.score.tracks.find((t) => trackMatches(t, 'drums')) : null);
  function setDrumsOnly(on) {
    const drums = drumTrack();
    prefs.drumsOnly = !!on;
    savePrefs();
    state.drumsOnly = !!on && !!drums;
    els.drumsBtn.setAttribute('aria-pressed', String(state.drumsOnly));
    if (drums) api.changeTrackSolo([drums], state.drumsOnly);
  }
  els.drumsBtn.addEventListener('click', () => setDrumsOnly(!state.drumsOnly));

  // A change of sound while a song plays: playback stops, the change is made, and playback starts again from the
  // beginning of the part being played (or of the song), so different sounds can be compared one after another.
  async function changeSound(change) {
    const wasPlaying = state.playing;
    if (wasPlaying) api.stop();
    try {
      await change();
    } finally {
      if (wasPlaying) {
        api.tickPosition = api.playbackRange ? api.playbackRange.startTick : 0;
        api.play();
      }
    }
  }

  // Drum feel: each drum hit is moved a little early or late, by an amount that is the same every time the song plays,
  // and its loudness can vary, and a roll can swell. Only playback changes; the file does not.
  const feelMemory = { straight: new WeakMap(), loudness: new WeakMap() };   // each beat's own timing and loudness
  let feelApplied = null;               // what the feel was last applied for
  // A number for a key that is the same every time: the same hit always gets the same feel.
  // The drum feel of this song: kept in its notes, so it goes to the band folder with the song.
  const drumFeelOf = () => {
    const f = (state.notes && state.notes.drumFeel) || {};
    return { ms: Number(f.ms) || 0, loud: !!f.loud, swell: !!f.swell };
  };
  function applyDrumFeel() {
    if (!state.score) return;
    const { ms, loud, swell } = drumFeelOf();
    const song = state.song && state.song.key;
    const tag = `${song}|${ms}|${loud ? 1 : 0}|${swell ? 1 : 0}|${state.trackIndex}`;
    if (feelApplied === tag) return;
    // nothing set: the straight drums are already what plays, so nothing needs rebuilding
    if (!ms && !loud && !swell && feelApplied === null) { feelApplied = tag; return; }
    const drums = drumTrack();
    if (drums) {
      const ticksPerMs = (960 * (state.score.tempo || 120)) / 60000;
      SM.drums.applyFeel(drums.staves[0].bars, { ms, loud, swell, ticksPerMs }, feelMemory);
      api.loadMidiForScore();
    }
    feelApplied = tag;
  }
  els.speedSel.addEventListener('change', () => {
    const v = Number(els.speedSel.value);
    api.playbackSpeed = v;
    media.rate(v);
  });
  els.prevBtn.addEventListener('click', () => selectView(state.view - 1));
  els.nextBtn.addEventListener('click', () => selectView(state.view + 1));
  els.viewSelTop.addEventListener('change', () => setView(els.viewSelTop.value));
  els.viewSelSet.addEventListener('change', () => setView(els.viewSelSet.value));

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

  // Empties the video panel, ready for a YouTube video or an MP3.
  function resetFrame() {
    audioSeq++;
    if (ytPlayer) { ytPlayer.destroy(); ytPlayer = null; ytReady = false; }
    if (audioEl) audioEl.pause();
    audioEl = null;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = null;
    els.videoPanel.classList.remove('audio-only');
    const holder = document.createElement('div');
    holder.id = 'ytPlayer';
    els.videoPanel.querySelector('.video-frame').replaceChildren(holder);
  }

  // The MP3 is read from this device, or from the band's Drive folder when this device does not have it yet.
  function playAudio() {
    const key = state.song.key;
    const meta = state.notes.audio;
    const seq = audioSeq;
    SM.library.audio.load(key, meta).then((clip) => {
      if (seq !== audioSeq || !state.song || state.song.key !== key) return;
      if (!clip) { toast('This MP3 is not on this device yet. Open the song when you are online.'); return; }
      audioUrl = URL.createObjectURL(new Blob([clip.bytes], { type: clip.type }));
      audioEl = document.createElement('audio');
      audioEl.controls = true;
      audioEl.preload = 'auto';
      audioEl.className = 'song-audio';
      audioEl.src = audioUrl;
      audioEl.playbackRate = Number(els.speedSel.value) || 1;
      els.videoPanel.querySelector('.video-frame').replaceChildren(audioEl);
    }).catch((e) => { console.error(e); toast('The MP3 could not be opened'); });
  }

  function setupVideo() {
    const id = youtubeId(state.notes && state.notes.youtubeUrl);
    const hasAudio = !!(state.notes && state.notes.audio);
    els.videoBtn.hidden = !id && !hasAudio;
    if (hasAudio) {
      resetFrame();
      els.videoPanel.classList.add('audio-only');
      els.videoPanel.hidden = !state.videoOn;
      els.videoBtn.setAttribute('aria-pressed', String(state.videoOn));
      playAudio();
      return;
    }
    if (audioEl) resetFrame();
    if (!id) {
      els.videoPanel.hidden = true;
      resetFrame();
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
    if (!media.ready() || state.view === -1) return;
    const t = state.parts[state.view].ref && state.parts[state.view].ref.videoTime;
    if (t != null) media.seek(t);
  }

  // Loops the media inside the selected section and lights up the section it is playing.
  setInterval(() => {
    if (!media.ready() || !state.parts.length || !media.playing()) return;
    const t = media.time();
    // a section's video time is where it is first played
    const timed = state.parts.map((p, i) => ({ i, t: !p.again && p.ref && p.ref.start === p.start ? p.ref.videoTime : null })).filter((x) => x.t != null);
    if (!timed.length) return;
    let cur = -1;
    timed.forEach((x) => { if (x.t <= t) cur = x.i; });
    setPlayingPart(cur);
  }, 250);

  // An MP3 plays in place of the YouTube video, with the same section start times.
  async function attachAudio(file) {
    if (!file || !state.song) return;
    const key = state.song.key;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      toast('Adding the MP3…');
      const old = state.notes.audio;
      const meta = await SM.library.audio.save(key, file.name, bytes);
      if (old && old.fileId && old.fileId !== meta.fileId) await SM.library.audio.discard(key, old).catch((e) => console.error(e));
      if (!state.song || state.song.key !== key) return;
      state.notes.audio = meta;
      saveNotes();
      setupVideo();
      toast('MP3 added. It plays where the video plays.');
    } catch (e) {
      console.error(e);
      toast(e.message && /read-only|Google|Drive/.test(e.message) ? e.message : 'The MP3 could not be added');
    }
  }
  els.audioInput.addEventListener('change', (e) => { attachAudio(e.target.files[0]); e.target.value = ''; });

  // The drum kit this song uses: the default, a kit in the band folder (or on this device), or a new one.
  const ADD_KIT = '__add';
  async function fillKitSelect() {
    if (!state.song) return;
    const key = state.song.key;
    const list = await SM.library.kits.list(key).catch(() => []);
    if (!state.song || state.song.key !== key) return;
    const current = kitId(kitMeta());
    els.kitSel.innerHTML = '';
    els.kitSel.appendChild(new Option('Default kit', 'default', false, current === 'default'));
    els.kitSel.appendChild(new Option('Built-in drums (no kit)', 'builtin', false, current === 'builtin'));
    list.forEach((k) => els.kitSel.appendChild(new Option(k.name, k.fileId || k.name, false, current === (k.fileId || k.name))));
    els.kitSel.appendChild(new Option('Add a drum kit…', ADD_KIT, false, false));
  }
  els.drumFeel.addEventListener('input', () => { els.drumFeelOut.textContent = `${els.drumFeel.value} ms`; });
  const feelChanged = () => {
    if (!state.notes) return;
    state.notes.drumFeel = { ms: Number(els.drumFeel.value) || 0, loud: els.drumLoud.checked, swell: els.drumSwell.checked };
    saveNotes();
    changeSound(() => applyDrumFeel());
  };
  const clickChanged = () => {
    if (!state.notes) return;
    state.notes.click = { countIn: els.countIn.checked, click: els.clickBars.checked };
    saveNotes();
    applyClick();
  };
  els.countIn.addEventListener('change', clickChanged);
  for (const [slider, out, key] of [[els.clickLevel, els.clickLevelOut, 'clickLevel'], [els.countInLevel, els.countInLevelOut, 'countInLevel']]) {
    slider.addEventListener('input', () => { out.textContent = `${slider.value}%`; });
    slider.addEventListener('change', () => { prefs[key] = Number(slider.value); savePrefs(); applyClick(); });
  }
  els.clickBars.addEventListener('change', clickChanged);
  els.drumLoud.addEventListener('change', feelChanged);
  els.drumSwell.addEventListener('change', feelChanged);
  els.drumFeel.addEventListener('change', feelChanged);
  els.soundLogCopy.addEventListener('click', async () => {
    const text = els.soundLogText.textContent;
    try {
      await navigator.clipboard.writeText(text);
      toast('Sound log copied');
    } catch (e) {
      const r = document.createRange();
      r.selectNodeContents(els.soundLogText);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      toast('Sound log selected: copy it from here');
    }
  });
  els.kitSel.addEventListener('change', async () => {
    const v = els.kitSel.value;
    if (v === ADD_KIT) { els.kitInput.click(); return; }
    if (v === 'default') delete state.notes.drumKit;
    else if (v === 'builtin') state.notes.drumKit = { builtin: true };
    else {
      const list = await SM.library.kits.list(state.song.key).catch(() => []);
      const k = list.find((x) => (x.fileId || x.name) === v);
      if (!k) return;
      state.notes.drumKit = { name: k.name, fileId: k.fileId };
    }
    saveNotes();
    changeSound(() => applyDrumKit());
  });
  els.kitInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !state.song) return;
    const key = state.song.key;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      SM.soundfont.asDrumKit(bytes);   // refuses a file that is not a SoundFont with presets
      const list = await SM.library.kits.list(key).catch(() => []);
      const base = file.name.replace(/\.sf2$/i, '');
      let name = base;
      for (let n = 2; list.some((k) => k.name === name); n++) name = `${base} ${n}`;
      toast('Adding the drum kit…');
      const meta = await SM.library.kits.add(key, name, bytes);
      if (state.song.key !== key) return;
      state.notes.drumKit = meta;
      saveNotes();
      fillKitSelect();
      changeSound(() => applyDrumKit());
      toast(`Drum kit “${name}” added${meta.fileId ? ' to the band folder' : ' on this device'}`);
    } catch (err) {
      console.error(err);
      toast(err.message && /SoundFont|read-only/.test(err.message) ? err.message : 'That file is not a drum kit (SoundFont .sf2)');
    }
  });
  els.audioRemove.addEventListener('click', async () => {
    const key = state.song.key;
    try {
      await SM.library.audio.remove(key, state.notes.audio);
    } catch (e) {
      console.error(e);
      toast('The MP3 could not be removed from the band folder');
    }
    delete state.notes.audio;
    saveNotes();
    setupVideo();
    toast('MP3 removed');
  });

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
    if (!confirmNoteEdits()) return;
    if (state.edit.ops.length) discardNoteEdits();
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

  // Opening a song adds a step to the browser's history, so the back gesture returns to the list instead of leaving the app.
  function showSongView() {
    if (!els.homeView.hidden) history.pushState({ setcardsSong: true }, '');
    els.homeView.hidden = true;
    els.songView.hidden = false;
  }
  // Back from a song: the step taken to open it is undone, and the list is shown when the browser goes back.
  function backToList() {
    if (history.state && history.state.setcardsSong) history.back();
    else showHome();
  }
  window.addEventListener('popstate', () => { if (!els.songView.hidden) showHome(); });

  async function openFromList(key, title) {
    showSongView();
    const ok = await openSong(key, title);
    if (!ok) backToList();
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
          try { await drive.signIn(); syncReadOnly(); renderHome(); } catch (e) { toast(e.message); }
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
  els.backBtn.addEventListener('click', backToList);

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
    els.capoSel.value = String(capoOf());
    els.songTitleInput.value = state.notes.title || '';
    els.songArtistInput.value = state.notes.artist || '';
    els.songTitleInput.disabled = els.songArtistInput.disabled = !canEditSong();
    els.capoSel.closest('.capo-field').hidden = !role().diagrams;
    els.audioRemove.hidden = !state.notes.audio;
    const feel = drumFeelOf();
    els.drumFeel.value = String(feel.ms);
    els.drumLoud.checked = feel.loud;
    els.drumSwell.checked = feel.swell;
    const c = clickSetup();
    els.countIn.checked = c.countIn;
    els.clickBars.checked = c.click;
    els.clickLevel.value = String(Number.isFinite(prefs.clickLevel) ? prefs.clickLevel : 100);
    els.clickLevelOut.textContent = `${els.clickLevel.value}%`;
    els.countInLevel.value = String(Number.isFinite(prefs.countInLevel) ? prefs.countInLevel : 100);
    els.countInLevelOut.textContent = `${els.countInLevel.value}%`;
    els.drumFeelOut.textContent = `${feel.ms} ms`;
    fillKitSelect();
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
    if (!Number.isInteger(i) || !state.score || !state.score.tracks[i]) return;
    prefs.tracks[state.song.key] = Object.assign({}, prefs.tracks[state.song.key], { [prefs.role]: i });
    savePrefs();
    state.partMissing = false;
    updateBanner();
    useTrack(i);
  });
  // The full tab shows chord names above the bars only when this instrument shows chords.
  // Chord names and diagrams for what you play: one setting, read by the song settings and the guitar row.
  function setShowChords(on) {
    prefs.chords[prefs.role] = !!on;
    savePrefs();
    syncChordToggles();
    applyChordVisibility();
    updateChartStatus();
    if (prefs.view === 'tab') api.render(); else redrawCards();
  }
  function syncChordToggles() {
    els.showChords.checked = showChords();
    document.querySelectorAll('.chord-diag-toggle').forEach((b) => b.setAttribute('aria-pressed', String(showChords())));
  }
  // A tap on a bar in the chart opens it in a card: a guitar bar shows its chord diagram, and a bass bar shows its tab.
  let barMini = null;
  function openBarFromChart(bar) {
    els.barPeekTitle.textContent = `Bar ${bar + 1}`;
    els.barPeekBody.innerHTML = '';
    if (role().diagrams) {
      const names = chordsAt(bar);
      els.barPeekBody.innerHTML = names.length
        ? `<div class="diagrams">${names.map((n) => SM.chords.diagram(n)).join('')}</div>`
        : '<p class="fine">No chord for this bar.</p>';
    } else {
      const holder = document.createElement('div');
      holder.className = 'bar-peek-tab';
      els.barPeekBody.appendChild(holder);
      barMini = new AT.AlphaTabApi(holder, {
        core: { fontDirectory: 'lib/font/', engine: renderEngine, logLevel: 'error', useWorkers: false, enableLazyLoading: false },
        display: { layoutMode: AT.LayoutMode.Page, startBar: bar + 1, barCount: 1, scale: 1.2, staveProfile: STAVES[prefs.stave] ?? AT.StaveProfile.Tab },
        notation: { rhythmMode: AT.TabRhythmMode.ShowWithBars },
        player: { playerMode: AT.PlayerMode.Disabled },
      });
      styleTab(barMini);
      barMini.updateSettings();
      barMini.renderScore(state.score, [state.trackIndex]);
    }
    els.barPeekDlg.showModal();
  }
  els.barPeekDlg.addEventListener('close', () => {
    if (barMini) { try { barMini.destroy(); } catch (e) { /* already gone */ } barMini = null; }
    els.barPeekBody.innerHTML = '';
  });
  // A bar opens on a long press (about half a second). A touch that moves is a scroll, so it does not count.
  // A tap on a bar opens it. A touch that moves is a scroll, so it does not open the bar.
  function attachBarPress(el, bar) {
    let moved = false, sx = 0, sy = 0;
    el.addEventListener('touchstart', (e) => { moved = false; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchmove', (e) => { if (Math.hypot(e.touches[0].clientX - sx, e.touches[0].clientY - sy) > 10) moved = true; }, { passive: true });
    el.addEventListener('click', () => {
      if (moved) { moved = false; return; }
      openBarFromChart(bar);
    });
  }
  /* ---------------- the chart editor (from the pencil on the chart) ---------------- */
  // Changes are kept in a draft until Done saves them; Back leaves the chart as it was.
  let chartDraft = null;
  const chartEditorGuitar = () => !!role().diagrams;
  const CE_BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  const TAG_COLOURS = { Stab: 'var(--c-chorus)', Slide: 'var(--c-bridge)' };
  function openChartEditor() {
    if (!state.score || !state.notes) return;
    const c = chartNotes();
    const chords = {};
    const origChords = {};
    state.score.masterBars.forEach((_, b) => {
      const raw = state.notes.chords && state.notes.chords[b];
      const text = raw === '-' ? '-' : chordsAt(b).map((n) => SM.chords.soundingOf(n, capoOf())).join(' ');
      chords[b] = text;
      origChords[b] = text;
    });
    chartDraft = {
      bass: { ...(c.notes || {}) },
      tags: JSON.parse(JSON.stringify(c.tags || {})),
      cues: { ...(c.cues || {}) },
      chords, origChords, step: 'all', sheetBar: null,
    };
    els.chartEditor.hidden = false;
    renderChartEditor();
  }
  function closeChartEditor() {
    chartDraft = null;
    els.chartEditor.hidden = true;
    els.chartEditor.innerHTML = '';
  }
  // Done: the draft becomes the song's chart (notes.chart), and its guitar chords are stored as the cards store them.
  function commitChartDraft() {
    const d = chartDraft;
    const n = state.notes;
    if (!d || !n || !state.score) return;
    const tidy = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => (Array.isArray(v) ? v.length : v !== '' && v !== undefined)));
    n.chart = { notes: tidy(d.bass), tags: tidy(d.tags), cues: tidy(d.cues) };
    if (chartEditorGuitar()) {
      n.chords = n.chords || {};
      state.score.masterBars.forEach((_, b) => {
        const v = (d.chords[b] || '').trim();
        if (v === d.origChords[b]) return;
        if (!v) delete n.chords[b];
        else if (v === '-') n.chords[b] = '-';
        else n.chords[b] = SM.chords.transposeText(v, -transposeSemis());
      });
    }
    closeChartEditor();
    chordsChanged();
    toast('Chart saved');
  }
  // The chart editor's bars, and the sections it shows for the chosen step.
  const ceBarText = (b) => (chartEditorGuitar() ? chartDraft.chords[b] || '' : chartDraft.bass[b] || '');
  function ceCellHtml(b) {
    const text = ceBarText(b);
    const tags = chartDraft.tags[b] || [];
    const rest = text === '-' || tags.includes('Rest');
    const cls = ['ce-cell', tags.includes('Stab') ? 'stab' : '', tags.includes('Slide') ? 'slide' : '', rest ? 'rest' : '', b === chartDraft.sheetBar ? 'sel' : ''].filter(Boolean).join(' ');
    const label = rest ? 'rest' : (text || '·');
    return `<button type="button" class="${cls}" data-bar="${b}" aria-label="Bar ${b + 1}${rest ? ', rest' : text ? `, ${esc(text)}` : ''}">${esc(label)}</button>`;
  }
  function ceUpdateCell(b) {
    const btn = els.chartEditor.querySelector(`.ce-cell[data-bar="${b}"]`);
    if (btn) btn.outerHTML = ceCellHtml(b);
  }
  function ceSectionHtml(g) {
    const d = chartDraft;
    const first = state.parts[g.occ[0]];
    const bars = [];
    for (let b = first.start; b <= first.end; b++) bars.push(b);
    const value = bars.map((b) => ceBarText(b)).join(' ');
    const base = SM.chart.baseKey(g.name);
    const cues = g.occ.map((pi, k) => {
      const key = `${base}:${k + 1}`;
      const label = g.occ.length > 1 ? `${base.replace(/^./, (c) => c.toUpperCase())} ${k + 1}` : g.name.replace(/\s*\d+$/, '');
      return `<div class="ce-cue"><span>${esc(label)}</span><input class="ce-cue-in" data-cue="${esc(key)}" aria-label="${esc(label)} cue" value="${esc(d.cues[key] || '')}"></div>`;
    }).join('');
    return `<section class="ce-sec" style="--seg:${segColor(g.kind)}">
      <div class="ce-sec-head"><h2>${esc(g.name)}</h2><span class="ce-n">${g.occ.length > 1 ? `${g.occ.length} times · ` : ''}bars ${first.start + 1} to ${first.end + 1}</span></div>
      <div class="ce-lbl">${chartEditorGuitar() ? 'Real chords (sounding)' : 'Notes'}</div>
      <input class="ce-in" data-start="${first.start}" data-count="${bars.length}" aria-label="${esc(g.name)} ${chartEditorGuitar() ? 'chords' : 'notes'}" value="${esc(value)}">
      <div class="ce-cells" style="--cols:${Math.min(9, bars.length)}">${bars.map(ceCellHtml).join('')}</div>
      <div class="ce-lbl">Lyric cues</div>
      ${cues}
    </section>`;
  }
  function renderChartEditor() {
    const d = chartDraft;
    const box = els.chartEditor;
    const guitar = chartEditorGuitar();
    const capo = capoOf();
    // the shapes to play, for the guitar: each distinct chord of the chart, moved down by the capo
    let shapes = '';
    if (guitar) {
      const names = [];
      Object.values(d.chords).forEach((text) => text.split(/\s+/).filter((t) => t && t !== '-').forEach((t) => {
        const shape = SM.chords.shapeOf(t, capo);
        if (!names.includes(shape)) names.push(shape);
      }));
      shapes = `<div class="ce-shapes"><div class="ce-lbl">Shapes to play${capo ? ` at capo ${capo}` : ''}</div>
        <div class="ce-shape-row">${names.length ? names.map((n) => `<div class="ce-shape">${SM.chords.diagram(n)}</div>`).join('') : '<p class="ce-help">No chords yet.</p>'}</div></div>`;
    }
    const groups = state.groups.filter((g) => d.step === 'all' || d.step === g.key);
    box.innerHTML = `
      <header class="ce-top">
        <button type="button" class="icon-btn" data-ce="back" aria-label="Back">${CE_BACK}</button>
        <div class="ce-grow"><h1>Edit chart</h1><div class="ce-sub">${esc(state.song.artist || '')} · ${guitar ? 'Guitar' : 'Bass'}${guitar && capo ? ` · Capo ${capo}` : ''} · ${state.score.masterBars.length} bars</div></div>
        <button type="button" class="ce-done" data-ce="done">Done</button>
      </header>
      <nav class="ce-steps" aria-label="Sections">
        <button type="button" class="${d.step === 'all' ? 'on' : ''}" data-step="all" style="--seg:var(--accent)">All</button>
        ${state.groups.map((g) => `<button type="button" class="${d.step === g.key ? 'on' : ''}" data-step="${esc(g.key)}" style="--seg:${segColor(g.kind)}">${esc(g.name)}</button>`).join('')}
      </nav>
      <div class="ce-body">
        ${shapes}
        <p class="ce-help">${guitar
          ? 'Type one chord per bar, separated by spaces. Type - for a rest bar. Tap a bar to add tags. Lyric cues are shared with bass, so editing them here updates both charts.'
          : 'Type one note per bar, separated by spaces. Tap a bar below to mark it as a stab, rest or slide. Lyric cues go under each time the section is sung.'}</p>
        ${groups.map(ceSectionHtml).join('')}
      </div>
      <div class="ce-sheet" hidden></div>`;
    if (d.sheetBar !== null) ceOpenSheet();
  }
  function ceOpenSheet() {
    const d = chartDraft;
    const b = d.sheetBar;
    const sheet = els.chartEditor.querySelector('.ce-sheet');
    const g = state.groups.find((x) => { const p = state.parts[x.occ[0]]; return b >= p.start && b <= p.end; });
    const text = ceBarText(b);
    const tags = d.tags[b] || [];
    const quick = SM.chart.QUICK_TAGS.map((t) => `<button type="button" class="ce-q${tags.includes(t) ? ' on' : ''}" data-quick="${t}">${t}</button>`).join('');
    sheet.hidden = false;
    sheet.innerHTML = `
      <div class="ce-sheet-head"><b>${esc(g ? g.name : '')}, bar ${b + 1}</b><small>${chartEditorGuitar() ? 'Chord' : 'Note'} ${esc(text || '—')}</small></div>
      <div class="ce-tags">${tags.map((t) => `<span class="ce-tag" style="--t:${TAG_COLOURS[t] || 'var(--muted)'}">${esc(t)} <button type="button" data-untag="${esc(t)}" aria-label="Remove ${esc(t)}">×</button></span>`).join('')}
        <input class="ce-tag-in" aria-label="Add a tag or note" placeholder="Add a tag, e.g. fill, hit, pickup"></div>
      <div class="ce-quick">${quick}</div>
      <button type="button" class="ce-close" data-ce="sheet-close">Done with bar</button>`;
  }
  function ceSetTags(b, list) {
    if (list.length) chartDraft.tags[b] = list; else delete chartDraft.tags[b];
  }
  function ceToggleTag(b, tag) {
    const d = chartDraft;
    const list = (d.tags[b] || []).slice();
    const i = list.indexOf(tag);
    if (i >= 0) list.splice(i, 1); else list.push(tag);
    ceSetTags(b, list);
    if (tag === 'Rest') {
      // the Rest tag is a rest bar: it is typed as "-", as the field shows it
      if (chartEditorGuitar()) d.chords[b] = i >= 0 ? '' : '-';
      else d.bass[b] = i >= 0 ? '' : '-';
    }
  }
  function ceAddTag(b, raw) {
    const t = String(raw || '').trim().replace(/^./, (c) => c.toUpperCase());
    if (!t) return;
    const list = (chartDraft.tags[b] || []).slice();
    if (!list.includes(t)) list.push(t);
    ceSetTags(b, list);
  }
  els.chartEditor.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t || !chartDraft) return;
    const d = chartDraft;
    if (t.dataset.ce === 'done') commitChartDraft();
    else if (t.dataset.ce === 'back') closeChartEditor();
    else if (t.dataset.ce === 'sheet-close') { d.sheetBar = null; renderChartEditor(); }
    else if (t.dataset.step !== undefined) { d.step = t.dataset.step; renderChartEditor(); }
    else if (t.dataset.untag !== undefined) { ceSetTags(d.sheetBar, (d.tags[d.sheetBar] || []).filter((x) => x !== t.dataset.untag)); ceUpdateCell(d.sheetBar); ceOpenSheet(); }
    else if (t.dataset.quick !== undefined) {
      ceToggleTag(d.sheetBar, t.dataset.quick);
      ceUpdateCell(d.sheetBar);
      if (t.dataset.quick === 'Rest') ceRefreshSection(d.sheetBar);
      ceOpenSheet();
    }
    else if (t.dataset.bar !== undefined) { d.sheetBar = Number(t.dataset.bar); renderChartEditor(); }
  });
  // The section field shows its bars again after a bar changes from the tag sheet.
  function ceRefreshSection(b) {
    const input = [...els.chartEditor.querySelectorAll('.ce-in')].find((i) => b >= Number(i.dataset.start) && b < Number(i.dataset.start) + Number(i.dataset.count));
    if (input) {
      const start = Number(input.dataset.start);
      const count = Number(input.dataset.count);
      const vals = [];
      for (let i = 0; i < count; i++) vals.push(ceBarText(start + i));
      input.value = vals.join(' ');
    }
  }
  els.chartEditor.addEventListener('input', (e) => {
    const d = chartDraft;
    if (!d) return;
    if (e.target.matches('.ce-in')) {
      // one entry per bar, in order, for the bars of the section
      const start = Number(e.target.dataset.start);
      const count = Number(e.target.dataset.count);
      const toks = e.target.value.split(/\s+/).filter(Boolean);
      for (let i = 0; i < count; i++) {
        const b = start + i;
        const v = toks[i] || '';
        if (chartEditorGuitar()) d.chords[b] = v; else d.bass[b] = v;
        ceUpdateCell(b);
      }
    } else if (e.target.matches('.ce-cue-in')) {
      d.cues[e.target.dataset.cue] = e.target.value.trim();
    }
  });
  els.chartEditor.addEventListener('keydown', (e) => {
    if (!chartDraft || chartDraft.sheetBar === null || !e.target.matches('.ce-tag-in') || e.key !== 'Enter') return;
    e.preventDefault();
    ceAddTag(chartDraft.sheetBar, e.target.value);
    ceUpdateCell(chartDraft.sheetBar);
    ceOpenSheet();
  });

  function applyChordVisibility() {
    const show = showChords();
    const els2 = api.settings.notation.elements;
    if (els2.get(AT.NotationElement.EffectChordNames) === show) return false;
    els2.set(AT.NotationElement.EffectChordNames, show);
    api.updateSettings();
    return true;
  }
  els.showChords.addEventListener('change', () => setShowChords(els.showChords.checked));
  // the capo is chosen in the song settings, and the chart shows it as text under the title
  els.capoSel.innerHTML = '<option value="0">No capo</option>' + Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">Capo ${i + 1}</option>`).join('');
  els.capoSel.addEventListener('change', () => setCapo(Number(els.capoSel.value)));
  // title and artist are kept with the song; an empty one goes back to the name in the file
  function setSongText(key, value) {
    if (!state.notes || !state.song) return;
    const v = value.trim();
    if (v) state.notes[key] = v; else delete state.notes[key];
    saveNotes();
    if (key === 'title') {
      state.song.title = v || state.song.fileTitle;
      els.songTitle.textContent = state.song.title;
      document.title = `${state.song.title} · Setcards`;
    } else {
      state.song.artist = v || state.song.fileArtist;
    }
    updateSongMeta();
  }
  els.songTitleInput.addEventListener('change', () => setSongText('title', els.songTitleInput.value));
  els.songArtistInput.addEventListener('change', () => setSongText('artist', els.songArtistInput.value));
  // on a phone, the chart's play button floats over the chart, and ⋯ opens the other playback controls
  els.moreBtn.addEventListener('click', () => {
    const open = !document.body.classList.contains('player-open');
    document.body.classList.toggle('player-open', open);
    els.moreBtn.setAttribute('aria-expanded', String(open));
  });
  els.showTabCards.addEventListener('change', () => {
    prefs.cardsTab[prefs.role] = els.showTabCards.checked;
    savePrefs();
    if (showingCards()) redrawCards();
  });
  document.querySelectorAll('input[name="stave"]').forEach((r) => r.addEventListener('change', () => {
    prefs.stave = r.value;
    savePrefs();
    api.settings.display.staveProfile = STAVES[r.value];
    api.updateSettings();
    if (prefs.view === 'tab') api.render(); else redrawCards();
  }));
  els.zoomRange.addEventListener('input', () => { els.zoomOut.textContent = `${Math.round(els.zoomRange.value * 100)}%`; });
  function setZoom(z) {
    z = Math.round(Math.min(1.8, Math.max(0.6, z)) * 10) / 10;
    prefs.zoom = z;
    savePrefs();
    api.settings.display.scale = z;
    api.updateSettings();
    if (prefs.view === 'tab') api.render(); else redrawCards();
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
      const data = overlays.without(() => new AT.exporter.Gp7Exporter().export(state.score, api.settings));
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
  fillRoleSelect();
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
        swRegistration = reg;
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
