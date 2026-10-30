// End-to-end checks of the main flows, using the built-in demo song.
// Google sign-in and Drive are replaced with stand-ins, since tests cannot sign in to Google.
const { test, expect } = require('@playwright/test');

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

// Opens the app as someone using it on their own, with the demo song added, and opens that song.
async function openDemo(page, path = '/') {
  await page.addInitScript(() => {
    if (!localStorage.getItem('setcards:prefs')) localStorage.setItem('setcards:prefs', JSON.stringify({ mode: 'solo' }));
  });
  await page.goto(path);
  await page.locator('#addDemoBtn').click();
  await page.locator('.song-row .song-open', { hasText: 'Low Road (demo)' }).click();
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 20000 });
}

// Stand-ins for the Google Drive source, so band features can be tested without signing in.
async function fakeDrive(page, { folder = { id: 'f1', name: 'The Band (Setcards)' }, signedIn = true } = {}) {
  await page.addInitScript(({ folder, signedIn }) => {
    localStorage.setItem('setcards:prefs', JSON.stringify({ mode: 'band' }));
    if (folder) localStorage.setItem('setcards:driveFolder', JSON.stringify(folder));
    window.fakeBandSongs = [];
    // Swap in the stand-ins the moment the app's library is created, before the home screen draws.
    let sm;
    Object.defineProperty(window, 'SM', {
      configurable: true,
      get() { return sm; },
      set(v) {
        sm = v;
        let library;
        Object.defineProperty(v, 'library', {
          configurable: true,
          get() { return library; },
          set(lib) {
            library = lib;
            const d = lib.sources.drive;
            d.configured = () => true;
            d.signedIn = () => signedIn;
            d.list = async () => { if (window.fakeListWait) await window.fakeListWait; return window.fakeBandSongs.map((s) => ({ ...s })); };
            d.listSaved = async () => window.fakeSavedSongs || null;
            d.open = async (id) => {
              const song = window.fakeBandSongs.find((x) => x.id === id);
              const out = { bytes: null, notes: song.notes, title: song.title, artist: song.artist, fileName: song.fileName };
              // stands in for a copy saved on the device, with a newer one waiting in Drive
              if (window.fakeLatest) out.latest = async () => window.fakeLatest;
              return out;
            };
            d.saveNotes = async (id, notes) => { window.fakeBandSongs.find((x) => x.id === id).notes = notes; };
            d.add = async (fileName, bytes, notes) => {
              const id = 'b' + (window.fakeBandSongs.length + 1);
              window.fakeBandSongs.push({ id, title: notes.title, artist: notes.artist, fileName, notes, hasTab: !!bytes, bytes: bytes ? bytes.length : 0 });
              return id;
            };
          }
        });
      }
    });
  }, { folder, signedIn });
}

const steps = (page) => page.locator('#structure .step');

test('first visit asks once how Setcards will be used', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('#welcome')).toBeVisible();
  // what you play comes first; then band or just you
  await expect(page.locator('#welcomeRoles .choice')).toHaveText([/Bass/, /Guitar/, /Vocals/, /Keys/, /Drums/]);
  await expect(page.locator('#chooseSolo')).toBeHidden();
  await page.locator('#welcomeRoles .choice', { hasText: 'Guitar' }).click();
  await page.click('#chooseSolo');
  await expect(page.locator('#welcome')).toBeHidden();
  await expect(page.locator('.list-title')).toHaveText('Your songs');
  await expect(page.locator('#homeRoleBtn')).toHaveText('Guitar');
  await page.reload();
  await expect(page.locator('#welcome')).toBeHidden();
  await expect(page.locator('#homeRoleBtn')).toHaveText('Guitar');
  expect(errors).toEqual([]);
});

test('the song list is home, and shows key, tempo and length once a song is opened', async ({ page }) => {
  await openDemo(page);
  await expect(page.locator('#songTitle')).toHaveText('Low Road (demo)');
  await page.click('#backBtn');
  await expect(page.locator('#homeView')).toBeVisible();
  await expect(page.locator('.song-row .details').first()).toHaveText(/\?? · 104 bpm · 2:28 · 10 sections/);
  await page.reload();
  await expect(page.locator('#homeView')).toBeVisible();
});

test('opens a song as cards, with the song order at the top', async ({ page }) => {
  const errors = watchErrors(page);
  await openDemo(page);
  await expect(steps(page)).toHaveText(['Whole song', 'Intro', 'Verse', 'Pre-chorus', 'Chorus', 'Verse', 'Pre-chorus', 'Chorus', 'Bridge', 'Chorus', 'Outro']);
  await expect(page.locator('.card-head h2')).toHaveText(['Intro', 'Verse', 'Pre-chorus', 'Chorus', 'Bridge', 'Outro']);
  await expect(page.locator('.mini-tab canvas').first()).toBeVisible();
  // alphaTab's credit is in the play bar, not in the parts
  await expect(page.locator('.playerbar .player-credit')).toHaveText('rendered by alphaTab');
  expect(errors).toEqual([]);
});

test('nothing on the page is wider than a phone screen', async ({ page }) => {
  await openDemo(page);
  const overflow = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth > window.innerWidth,
    scroller: document.getElementById('scroller').scrollWidth > document.getElementById('scroller').clientWidth
  }));
  expect(overflow).toEqual({ page: false, scroller: false });
});

test('tapping a section in the song order scrolls to its card', async ({ page }) => {
  await openDemo(page);
  await steps(page).nth(4).click();
  await expect(page.locator('.card[data-group="chorus"]')).toBeInViewport();
});

test('the full tab shows one section at a time, or the whole song', async ({ page }) => {
  await openDemo(page);
  await page.click('#viewTab:visible, #viewTabTop:visible');
  await expect(page.locator('#tab .at-surface canvas').first()).toBeVisible();
  await steps(page).nth(4).click();
  await expect(page.locator('#sectionName')).toHaveText('Chorus');
  await expect(page.locator('#sectionBars')).toContainText('1 of 3');
  await page.click('#nextBtn');
  await expect(page.locator('#sectionName')).toHaveText('Verse');
  // the Whole song pill is hidden when the phone is held upright, so go back with Previous
  for (let i = 0; i < 12; i++) {
    if ((await page.locator('#sectionName').textContent()) === 'Whole song') break;
    await page.click('#prevBtn');
  }
  await expect(page.locator('#sectionName')).toHaveText('Whole song');
});

async function chooseRole(page, label) {
  await page.click('#roleBtn');
  await page.click(`.role-opt:has-text("${label}")`);
  await expect(page.locator('#roleBtn')).toHaveText(label);
}

test('chords entered on a riff apply to every repeat and survive a reload', async ({ page }) => {
  await openDemo(page);
  await chooseRole(page, 'Guitar');
  const verseCard = page.locator('.card[data-group="verse"]');
  await verseCard.locator('.chord-cell').first().click();
  await expect(page.locator('#chordAllLabel')).toContainText('Every time riff');
  await page.fill('#chordInput', 'Em');
  await expect(page.locator('#chordPreview svg')).toHaveCount(1);
  await page.click('#chordForm button[type=submit]');
  await expect(page.locator('#toast')).toContainText(/Chords set in \d+ bars/);
  await expect(verseCard.locator('.chord-cell').first()).toHaveText('Em');
  await page.reload();
  await page.locator('.song-row .song-open').first().click();
  await expect(page.locator('.card[data-group="verse"] .chord-cell').first()).toHaveText('Em');
});

test('a capo is chosen at the top of the song, and shows the chord shapes to play', async ({ page }) => {
  await openDemo(page);
  await chooseRole(page, 'Guitar');
  // a chord on the first bar, then the capo changes the shape shown for it
  const first = page.locator('.chord-cell').first();
  await first.click();
  await page.fill('#chordInput', 'Dm7');
  await page.click('#chordForm button[type=submit]');
  await expect(first).toHaveText('Dm7');
  const before = await first.textContent();
  await page.selectOption('#capoTop', '2');
  await expect(first).not.toHaveText(before);
  await expect(page.locator('#capoTop')).toHaveValue('2');
  await expect(page.locator('#songMeta')).not.toContainText('Capo');
  // the capo is kept with the song: it is still set after going back to the list and in the full tab
  await page.click('#backBtn');
  await page.locator('.song-row .song-open', { hasText: 'Low Road (demo)' }).click();
  await expect(page.locator('#capoTop')).toHaveValue('2');
  await page.selectOption('#capoTop', '0');
  await expect(first).toHaveText(before);
});

test('guitar shows chord diagrams and vocals shows the cue list', async ({ page }) => {
  await openDemo(page);
  await chooseRole(page, 'Guitar');
  await page.locator('.card[data-group="verse"] .chord-cell').first().click();
  await page.fill('#chordInput', 'Em C');
  await page.click('#chordForm button[type=submit]');
  await expect(page.locator('.diagram-strip .chord-svg')).toHaveCount(2);

  await page.click('#roleBtn');
  await page.click('.role-opt:has-text("Vocals")');
  await expect(page.locator('.cue')).toHaveCount(10);
  await expect(page.locator('.cue').first()).toContainText('Intro');
});

test('instrument notes are kept with the song and shown only in that instrument’s view', async ({ page }) => {
  await openDemo(page);
  const verseCard = page.locator('.card[data-group="verse"]');
  // held upright the card has no note button: a long press opens the part's details, which have one
  await verseCard.evaluate((el) => el.dispatchEvent(new Event('touchstart', { bubbles: true })));
  await page.waitForTimeout(650);
  await verseCard.evaluate((el) => el.dispatchEvent(new Event('touchend', { bubbles: true })));
  await page.locator('dialog.part-detail .add-note').click();
  await expect(page.locator('#noteTitle')).toHaveText('Bass note · Verse');
  await page.fill('#noteText', 'Walk up into the chorus');
  await page.click('#noteForm button[type=submit]');
  await expect(verseCard.locator('.role-note-text')).toHaveText('Walk up into the chorus');
  // close the part's details, which opened with the long press
  await page.keyboard.press('Escape');

  await page.click('#roleBtn');
  await page.click('.role-opt:has-text("Guitar")');
  await expect(page.locator('.card[data-group="verse"] .role-note')).toHaveCount(0);

  await page.click('#roleBtn');
  await page.click('.role-opt:has-text("Bass")');
  await page.reload();
  await page.locator('.song-row .song-open').first().click();
  await expect(page.locator('.card[data-group="verse"] .role-note-text')).toHaveText('Walk up into the chorus');
});

test('the band key, original key and tempo are recorded and shown in the song list', async ({ page }) => {
  await openDemo(page);
  await page.click('#settingsBtn');
  await page.selectOption('#originalKeyInput', 'E');
  await page.selectOption('#bandKeyInput', 'D');
  await page.fill('#tempoInput', '100');
  await page.locator('#tempoInput').blur();
  await expect(page.locator('#keyInfo')).toContainText('The band plays this 2 semitones lower than the recording.');
  await page.locator('#settingsDlg [data-close]').click();
  await expect(page.locator('#songMeta')).toContainText('D · 100 bpm');
  await page.click('#backBtn');
  await expect(page.locator('.song-row .details').first()).toContainText('D (orig. E) · 100 bpm');
});
test('in Edit, tapping a bar starts a new section there', async ({ page }) => {
  await openDemo(page);
  await page.click('#editBtn');
  await expect(page.locator('#editPanel')).toBeVisible();
  const surface = page.locator('#tab .at-surface');
  await expect(surface.locator('canvas').first()).toBeVisible();
  await page.locator('#scroller').evaluate((el) => { el.scrollTop = 200; });
  const box = await surface.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + 260);
  await expect(page.locator('#barDlg')).toBeVisible();
  await page.fill('#barName', 'Solo');
  await page.click('#barSubmit');
  await expect(steps(page).filter({ hasText: 'Solo' })).toHaveCount(1);
});

test('in a band, the home screen waits for a tap before signing in to Google', async ({ page }) => {
  const signIns = [];
  // Google's scripts load at start, so only sign-in and Drive requests count here
  page.on('request', (r) => { if (/accounts\.google\.com\/o\/oauth2|googleapis\.com\/drive/.test(r.url())) signIns.push(r.url()); });
  await page.addInitScript(() => {
    localStorage.setItem('setcards:prefs', JSON.stringify({ mode: 'band' }));
    localStorage.setItem('setcards:driveFolder', JSON.stringify({ id: 'f1', name: 'The Band (Setcards)' }));
  });
  await page.goto('/');
  await expect(page.locator('#bandBox')).toContainText('The Band (Setcards)');
  await expect(page.locator('#homeSignIn')).toHaveText('Show band songs');
  expect(signIns).toEqual([]);
});

test('drafts stay on this device until shared with the band', async ({ page }) => {
  await fakeDrive(page);
  await page.goto('/');
  await expect(page.locator('.list-title').first()).toHaveText('The Band (Setcards)');
  // make a draft from the demo song as a Guitar Pro file
  await page.evaluate(async () => {
    const imp = new alphaTab.importer.AlphaTexImporter();
    imp.initFromString(window.DEMO_SONG.tex, new alphaTab.Settings());
    const bytes = new alphaTab.exporter.Gp7Exporter().export(imp.readScore(), new alphaTab.Settings());
    const notes = SM.library.emptyNotes({ title: 'Groove draft', artist: 'Me' });
    await SM.library.sources.local.add('groove.gp', bytes, notes, { title: 'Groove draft', artist: 'Me' });
  });
  await page.reload();
  const drafts = page.locator('.list-section', { hasText: 'Drafts' });
  await expect(drafts.locator('.song-row')).toHaveCount(1);
  await drafts.locator('button', { hasText: 'Share with band' }).click();
  await expect(page.locator('#toast')).toContainText('is now in the band folder');
  await expect(page.locator('.list-section', { hasText: 'Drafts' })).toHaveCount(0);
  await expect(page.locator('.list-section').first().locator('.song-row')).toHaveText(/Groove draft/);
});

test('connecting the band folder from the home screen', async ({ page }) => {
  await fakeDrive(page, { folder: null });
  await page.goto('/');
  await page.evaluate(() => {
    SM.library.sources.drive.connect = async () => {
      localStorage.setItem('setcards:driveFolder', JSON.stringify({ id: 'f2', name: 'Picked folder' }));
      return { id: 'f2', name: 'Picked folder' };
    };
  });
  await page.click('#gPick');
  await expect(page.locator('#toast')).toContainText('Connected to “Picked folder”');
  await expect(page.locator('.list-title').first()).toHaveText('Picked folder');
});

test('an invite link offers to join the named band folder', async ({ page }) => {
  await page.goto('/?band=folder123&name=The%20Band');
  await expect(page.locator('#joinDlg')).toBeVisible();
  await expect(page.locator('#joinTitle')).toHaveText('Join “The Band”');
  await page.evaluate(() => {
    SM.library.sources.drive.connect = async (id) => {
      window.joinedId = id;
      localStorage.setItem('setcards:driveFolder', JSON.stringify({ id, name: 'The Band' }));
      return { id, name: 'The Band' };
    };
  });
  await page.click('#joinBtn');
  await expect(page.locator('#toast')).toContainText('Connected to “The Band”');
  expect(await page.evaluate(() => window.joinedId)).toBe('folder123');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('setcards:prefs')).mode)).toBe('band');
  expect(new URL(page.url()).search).toBe('');
});

test('band settings share an invite link for the connected folder', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await fakeDrive(page, { folder: { id: 'f9', name: 'Our Band' } });
  await page.addInitScript(() => { navigator.share = undefined; });
  await page.goto('/');
  await page.click('#bandBtn');
  await page.click('#gInvite');
  await expect(page.locator('#toast')).toContainText('Invite link copied');
  const u = new URL(await page.evaluate(() => navigator.clipboard.readText()));
  expect(u.searchParams.get('band')).toBe('f9');
  expect(u.searchParams.get('name')).toBe('Our Band');
});

// A Guitar Pro file made from the demo song, for tests that upload one.
async function demoGpFile() {
  const alphaTab = await import('@coderline/alphatab');
  globalThis.window = globalThis;
  require('../../demo.js');
  const imp = new alphaTab.importer.AlphaTexImporter();
  imp.initFromString(globalThis.DEMO_SONG.tex, new alphaTab.Settings());
  const bytes = new alphaTab.exporter.Gp7Exporter().export(imp.readScore(), new alphaTab.Settings());
  return { name: 'low-road.gp', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) };
}

test('a song can be added with just a name, then given its tab later', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => localStorage.setItem('setcards:prefs', JSON.stringify({ mode: 'solo' })));
  await page.goto('/');
  await page.click('#addSongBtn');
  await page.fill('#addTitle', 'Low Road');
  await page.fill('#addArtist', 'The Demos');
  await page.fill('#addYt', 'https://youtu.be/dQw4w9WgXcQ');
  await page.click('#addForm button[type=submit]');

  // it opens on the no-tab page, keeping what was entered
  await expect(page.locator('#noTab h2')).toHaveText('No tab yet');
  await expect(page.locator('#songMeta')).toContainText('Proposed · The Demos');
  await expect(page.locator('#noTabYt')).toHaveValue('https://youtu.be/dQw4w9WgXcQ');
  await expect(page.locator('#noTab a', { hasText: 'Songsterr' })).toHaveAttribute('href', /pattern=Low%20Road%20The%20Demos/);
  await page.locator('#noTab .add-note').click();
  await page.fill('#noteText', 'Check the key with the singer');
  await page.click('#noteForm button[type=submit]');
  await expect(page.locator('#noTab .role-note-text')).toHaveText('Check the key with the singer');

  // listed under Proposed, marked as having no tab
  await page.click('#backBtn');
  const proposed = page.locator('.list-section', { hasText: 'Proposed' });
  await expect(proposed.locator('.song-row')).toHaveCount(1);
  await expect(proposed.locator('.details')).toHaveText('No tab yet');

  // attach the tab: sections and riffs appear, and the note is still there
  await proposed.locator('.song-open').click();
  await page.locator('#attachInput').setInputFiles(await demoGpFile());
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#songMeta')).toContainText('Proposed');
  await expect(page.locator('.cards > .role-note .role-note-text')).toHaveText('Check the key with the singer');
  await page.click('#backBtn');
  // still proposed until the band decides it is being learnt
  await expect(page.locator('.list-section', { hasText: 'Proposed' })).toHaveCount(1);
  await expect(page.locator('.song-row .details').first()).toContainText('104 bpm');
  expect(errors).toEqual([]);
});

test('a proposed song can be added for the band', async ({ page }) => {
  await fakeDrive(page);
  await page.goto('/');
  await page.click('#addSongBtn');
  await expect(page.locator('#shareUploadWrap')).toBeVisible();
  await page.fill('#addTitle', 'New Idea');
  await page.click('#addForm button[type=submit]');
  await expect(page.locator('#toast')).toContainText('Added “New Idea” for the band');
  const added = await page.evaluate(() => window.fakeBandSongs[0]);
  expect(added.hasTab).toBe(false);
  expect(added.notes.status).toBe('proposed');
  await page.click('#backBtn');
  await expect(page.locator('.list-section', { hasText: 'Proposed' }).locator('.song-row')).toHaveText(/New Idea/);
});

test('band settings show which version of Setcards is running', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('setcards:prefs', JSON.stringify({ mode: 'solo' })));
  await page.goto('/');
  await page.click('#bandBtn');
  await expect(page.locator('#modeBox .version')).toHaveText('Setcards version in development');
});

test('the bass view hides chords unless they are turned on', async ({ page }) => {
  // these check the words alphaTab writes, which only the SVG engine leaves in the page
  await page.addInitScript(() => localStorage.setItem('setcards:engine', 'svg'));
  await openDemo(page);
  await chooseRole(page, 'Guitar');
  // bar 1 (the intro), so it is in the part of the full tab that is drawn first
  await page.locator('.card[data-group="intro"] .chord-cell').first().click();
  await page.fill('#chordInput', 'Em');
  await page.click('#chordForm button[type=submit]');

  await chooseRole(page, 'Bass');
  await expect(page.locator('.chord-row')).toHaveCount(0);
  await page.click('#viewTab:visible, #viewTabTop:visible');
  await expect(page.locator('#tab .at-surface svg').first()).toBeVisible();
  await expect(page.locator('#tab text', { hasText: 'Intro' }).first()).toBeVisible();
  await expect(page.locator('#tab text', { hasText: /^Em$/ })).toHaveCount(0);

  await page.click('#settingsBtn');
  await expect(page.locator('#showChords')).not.toBeChecked();
  await page.check('#showChords');
  await page.locator('#settingsDlg [data-close]').click();
  await expect(page.locator('#tab text', { hasText: /^Em$/ }).first()).toBeVisible();
  await page.click('#viewCards:visible, #viewCardsTop:visible');
  await expect(page.locator('.card[data-group="intro"] .chord-cell').first()).toHaveText('Em');
});

test('the tab can be transposed for the band or just on this device', async ({ page }) => {
  // these check the words alphaTab writes, which only the SVG engine leaves in the page
  await page.addInitScript(() => localStorage.setItem('setcards:engine', 'svg'));
  await openDemo(page);
  await chooseRole(page, 'Guitar');
  // a chord in the tab's own key
  await page.locator('.card[data-group="intro"] .chord-cell').first().click();
  await page.fill('#chordInput', 'Em');
  await page.click('#chordForm button[type=submit]');
  await page.click('#viewTab:visible, #viewTabTop:visible');
  const firstFrets = () => page.evaluate(() => [...document.querySelectorAll('#tab text')].map((t) => t.textContent).filter((t) => /^\d+$/.test(t)).slice(1, 4).join(' '));
  await expect(page.locator('#tab .at-surface svg').first()).toBeVisible();
  const before = await firstFrets();

  // for the band: up 2
  await page.click('#settingsBtn');
  await page.click('#bandTrUp');
  await page.click('#bandTrUp');
  await expect(page.locator('#bandTrOut')).toHaveText('+2');
  await page.locator('#settingsDlg [data-close]').click();
  await expect(page.locator('#songMeta')).toContainText('tab +2');
  await expect(page.locator('#tab text', { hasText: /^F#m$/ }).first()).toBeVisible();
  expect(await firstFrets()).not.toEqual(before);

  // just for me: back to as written, without changing the band's setting
  await page.click('#settingsBtn');
  await page.click('#myTrDown');
  await page.click('#myTrDown');
  await expect(page.locator('#myTrOut')).toHaveText('0');
  await expect(page.locator('#bandTrOut')).toHaveText('+2');
  await page.locator('#settingsDlg [data-close]').click();
  await expect(page.locator('#tab text', { hasText: /^Em$/ }).first()).toBeVisible();
  expect(await firstFrets()).toEqual(before);

  // back to the band's setting
  await page.click('#settingsBtn');
  await page.click('#myTrReset');
  await expect(page.locator('#myTrOut')).toHaveText('same');
  await page.locator('#settingsDlg [data-close]').click();
  await expect(page.locator('#songMeta')).toContainText('tab +2');
});

test('match band key works out the transposition from the tab key', async ({ page }) => {
  await openDemo(page);
  await page.click('#settingsBtn');
  await page.selectOption('#tabKeyInput', 'Em');
  await page.selectOption('#bandKeyInput', 'Dm');
  await expect(page.locator('#keyInfo')).toContainText('The tab is in E minor.');
  await page.click('#matchKeyBtn');
  await expect(page.locator('#bandTrOut')).toHaveText('-2');
  await expect(page.locator('#keyInfo')).toContainText('shown -2 in D minor');
  // the whole song shows the keys in words, with the scale
  await page.locator('#settingsDlg [data-close]').click();
  const keys = page.locator('.song-keys');
  await expect(keys).toContainText('Band key');
  await expect(keys).toContainText('D minor');
  await expect(keys).toContainText('-2 from E minor');
});

test('a tab without a bass part says so in the bass view', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => localStorage.setItem('setcards:prefs', JSON.stringify({ mode: 'solo', role: 'bass' })));
  await page.goto('/');
  await page.click('#addSongBtn');
  await page.fill('#addTitle', 'Guitar Only');
  await page.click('#addForm button[type=submit]');
  const alphaTab = await import('@coderline/alphatab');
  const imp = new alphaTab.importer.AlphaTexImporter();
  imp.initFromString('\\title "Guitar Only"\n.\n\\track "Nylon"\n\\instrument 24\n0.6.4 2.5.4 2.4.4 1.3.4 | 0.6.4 2.5.4 2.4.4 1.3.4 |', new alphaTab.Settings());
  const bytes = new alphaTab.exporter.Gp7Exporter().export(imp.readScore(), new alphaTab.Settings());
  await page.locator('#attachInput').setInputFiles({ name: 'guitar-only.gp', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 20000 });
  await page.click('#noticeBtn');
  await expect(page.locator('#noticeText')).toHaveText('This tab only has the guitar part, with no bass part, so that is what’s shown here.');
  expect(errors).toEqual([]);
});

test('band songs show the saved copy at once and say when the latest has been checked', async ({ page }) => {
  await fakeDrive(page);
  await page.addInitScript(() => {
    window.fakeSavedSongs = [{ id: 'b1', title: 'Old Title', artist: 'Band', notes: { title: 'Old Title' }, hasTab: true, addedAt: 1 }];
    window.fakeBandSongs = [{ id: 'b1', title: 'New Title', artist: 'Band', notes: { title: 'New Title' }, hasTab: true, addedAt: 1 }];
    window.fakeListWait = new Promise((resolve) => { window.finishList = resolve; });
  });
  await page.goto('/');
  await expect(page.locator('.song-row strong')).toHaveText('Old Title');
  await expect(page.locator('#syncBtn')).toHaveClass(/busy/);
  await expect(page.locator('#syncBtn')).toHaveAttribute('title', /Checking Google Drive/);
  await page.evaluate(() => window.finishList());
  await expect(page.locator('.song-row strong')).toHaveText('New Title');
  await expect(page.locator('#syncBtn')).not.toHaveClass(/busy/);
  await expect(page.locator('#syncBtn')).toHaveAttribute('title', 'Up to date');
});

test('songs are listed in the order they were added, and can be sorted by title or artist', async ({ page }) => {
  await page.addInitScript(() => { if (!localStorage.getItem('setcards:prefs')) localStorage.setItem('setcards:prefs', JSON.stringify({ mode: 'solo' })); });
  await page.goto('/');
  for (const [title, artist] of [['Bravo', 'Zed'], ['Alpha', 'Yolo'], ['Charlie', '']]) {
    await page.click('#addSongBtn');
    await page.fill('#addTitle', title);
    await page.fill('#addArtist', artist);
    await page.click('#addForm button[type=submit]');
    await page.click('#backBtn');
  }
  const titles = page.locator('.song-row strong');
  await expect(titles).toHaveText(['Bravo', 'Alpha', 'Charlie']);
  await page.locator('.sort-bar button', { hasText: 'Title' }).click();
  await expect(titles).toHaveText(['Alpha', 'Bravo', 'Charlie']);
  await page.locator('.sort-bar button', { hasText: 'Artist' }).click();
  await expect(titles).toHaveText(['Alpha', 'Bravo', 'Charlie']);
  await page.reload();
  await expect(titles).toHaveText(['Alpha', 'Bravo', 'Charlie']);
  await page.locator('.sort-bar button', { hasText: 'Added' }).click();
  await expect(titles).toHaveText(['Bravo', 'Alpha', 'Charlie']);
});

test.describe('on a desktop browser', () => {
  test.use({ viewport: { width: 1280, height: 700 }, isMobile: false, hasTouch: false });
  test('a long song list scrolls, also after opening a song without tab', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('setcards:prefs', JSON.stringify({ mode: 'solo' })));
    await page.goto('/');
    for (let i = 0; i < 12; i++) {
      await page.click('#addSongBtn');
      await page.fill('#addTitle', 'Song ' + i);
      await page.click('#addForm button[type=submit]');
      await page.click('#backBtn');
    }
    const main = page.locator('#homeMain');
    await expect.poll(() => main.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await page.mouse.move(640, 400);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => main.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });
});

test('a band song opens from the saved copy, then shows what the band changed', async ({ page }) => {
  await fakeDrive(page);
  await page.addInitScript(() => {
    window.fakeBandSongs = [{ id: 'b1', title: 'Easy', artist: 'Commodores', notes: { title: 'Easy', artist: 'Commodores' }, hasTab: false }];
    window.fakeLatest = { bytes: null, notes: { title: 'Easy', artist: 'Commodores', status: 'ready' }, title: 'Easy', artist: 'Commodores', fileName: null };
  });
  await page.goto('/');
  await page.locator('.song-row .song-open', { hasText: 'Easy' }).click();
  await expect(page.locator('#songTitle')).toHaveText('Easy');
  await expect(page.locator('#toast')).toContainText('Updated with the band’s latest changes');
  // it was proposed in the saved copy; the band has since marked it ready
  await expect(page.locator('#songMeta')).not.toContainText('Proposed');
  await expect(page.locator('#songMeta')).toContainText('Commodores');
});

test.describe('on a phone turned on its side', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  test('cards become a screen per part, picked from a compact song order with bar counts', async ({ page }) => {
    const errors = watchErrors(page);
    await openDemo(page);
    await expect(page.locator('body')).toHaveClass(/paged/);
    await expect(page.locator('#songView .playerbar')).toBeHidden();
    await expect(page.locator('#editBtn')).toBeHidden();
    const verse = steps(page).filter({ hasText: 'Verse' }).first();
    expect(Number(await verse.getAttribute('data-bars'))).toBeGreaterThan(0);
    // a tap on a later part slides its card into view, no scrolling needed
    const cards = page.locator('#cards');
    await steps(page).filter({ hasText: 'Outro' }).click();
    await expect.poll(() => cards.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    await expect(steps(page).filter({ hasText: 'Outro' })).toHaveClass(/in-view/);
    // upright again, everything is back
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('body')).not.toHaveClass(/paged/);
    await expect(page.locator('#songView .playerbar')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test('a part the bass sits out has no card, and its chip says how many bars to wait', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('setcards:prefs', JSON.stringify({ mode: 'solo', role: 'bass' })));
  await page.goto('/');
  await page.click('#addSongBtn');
  await page.fill('#addTitle', 'Late Bass');
  await page.click('#addForm button[type=submit]');
  const alphaTab = await import('@coderline/alphatab');
  const imp = new alphaTab.importer.AlphaTexImporter();
  const gtr = Array(8).fill('0.6.4 2.5.4 2.4.4 1.3.4').join(' | ');
  const bass = ['r.1', 'r.1', 'r.1', 'r.1', '0.4.2 3.4.2', '5.4.2 3.4.2', '0.4.2 3.4.2', '5.4.2 3.4.2'].join(' | ');
  imp.initFromString(`\\title "Late Bass"\n.\n\\track "Gtr"\n\\section "Intro" ${gtr.split(' | ').slice(0, 4).join(' | ')} | \\section "Verse" ${gtr.split(' | ').slice(4).join(' | ')} |\n\\track "Bass"\n\\staff {tabs}\n\\tuning (G2 D2 A1 E1)\n\\instrument 33\n${bass} |`, new alphaTab.Settings());
  const bytes = new alphaTab.exporter.Gp7Exporter().export(imp.readScore(), new alphaTab.Settings());
  await page.locator('#attachInput').setInputFiles({ name: 'late-bass.gp', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.card h2')).toHaveText('Verse');
  const intro = steps(page).filter({ hasText: 'Intro' });
  await expect(intro).toHaveClass(/rest/);
  await expect(intro).toHaveAttribute('data-bars', '4');
});

test('going back to the band list does not redraw it when nothing has changed', async ({ page }) => {
  await fakeDrive(page);
  await page.addInitScript(() => {
    window.fakeBandSongs = [
      { id: 'b1', title: 'Alpha', artist: 'Band', notes: { title: 'Alpha', artist: 'Band', status: 'ready' }, hasTab: false, addedAt: 1 },
      { id: 'b2', title: 'Bravo', artist: 'Band', notes: { title: 'Bravo', artist: 'Band', status: 'ready' }, hasTab: false, addedAt: 2 }
    ];
  });
  await page.goto('/');
  await expect(page.locator('.song-row')).toHaveCount(2);
  // a marker on the row element (not in its HTML, which would count as a change): it survives only if the list is not redrawn
  await page.locator('.song-row').first().evaluate((el) => { el.keptMarker = true; });
  await page.locator('.song-row .song-open', { hasText: 'Bravo' }).click();
  await page.click('#backBtn');
  await page.waitForTimeout(1000);
  expect(await page.locator('.song-row').first().evaluate((el) => el.keptMarker === true)).toBe(true);
});
