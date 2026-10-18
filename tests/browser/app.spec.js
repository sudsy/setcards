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
            d.list = async () => window.fakeBandSongs.map((s) => ({ ...s }));
            d.open = async (id) => {
              const song = window.fakeBandSongs.find((x) => x.id === id);
              return { bytes: null, notes: song.notes, title: song.title, artist: song.artist, fileName: song.fileName };
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
  await page.click('#chooseSolo');
  await expect(page.locator('#welcome')).toBeHidden();
  await expect(page.locator('.list-title')).toHaveText('Your songs');
  await page.reload();
  await expect(page.locator('#welcome')).toBeHidden();
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
  await expect(page.locator('.mini-tab svg').first()).toBeVisible();
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
  await page.click('#viewTab');
  await expect(page.locator('#tab .at-surface svg').first()).toBeVisible();
  await steps(page).nth(4).click();
  await expect(page.locator('#sectionName')).toHaveText('Chorus');
  await expect(page.locator('#sectionBars')).toContainText('1 of 3');
  await page.click('#nextBtn');
  await expect(page.locator('#sectionName')).toHaveText('Verse');
  await page.locator('#structure .step.whole').click();
  await expect(page.locator('#sectionName')).toHaveText('Whole song');
});

test('chords entered on a riff apply to every repeat and survive a reload', async ({ page }) => {
  await openDemo(page);
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

test('guitar shows chord diagrams and vocals shows the cue list', async ({ page }) => {
  await openDemo(page);
  await page.locator('.card[data-group="verse"] .chord-cell').first().click();
  await page.fill('#chordInput', 'Em C');
  await page.click('#chordForm button[type=submit]');

  await page.click('#roleBtn');
  await page.click('.role-opt:has-text("Guitar")');
  await expect(page.locator('#roleBtn')).toHaveText('Guitar');
  await expect(page.locator('.diagram-strip .chord-svg')).toHaveCount(2);

  await page.click('#roleBtn');
  await page.click('.role-opt:has-text("Vocals")');
  await expect(page.locator('.cue')).toHaveCount(10);
  await expect(page.locator('.cue').first()).toContainText('Intro');
});

test('instrument notes are kept with the song and shown only in that instrument’s view', async ({ page }) => {
  await openDemo(page);
  const verseCard = page.locator('.card[data-group="verse"]');
  await verseCard.locator('.add-note').click();
  await expect(page.locator('#noteTitle')).toHaveText('Bass note · Verse');
  await page.fill('#noteText', 'Walk up into the chorus');
  await page.click('#noteForm button[type=submit]');
  await expect(verseCard.locator('.role-note-text')).toHaveText('Walk up into the chorus');

  await page.click('#roleBtn');
  await page.click('.role-opt:has-text("Guitar")');
  await expect(page.locator('.card[data-group="verse"] .role-note')).toHaveCount(0);

  await page.click('#roleBtn');
  await page.click('.role-opt:has-text("Bass")');
  await page.reload();
  await page.locator('.song-row .song-open').first().click();
  await expect(page.locator('.card[data-group="verse"] .role-note-text')).toHaveText('Walk up into the chorus');
});

test('key and tempo can be corrected and show in the song list', async ({ page }) => {
  await openDemo(page);
  await page.click('#settingsBtn');
  await page.fill('#keyInput', 'Em');
  await page.fill('#tempoInput', '100');
  await page.locator('#tempoInput').blur();
  await page.locator('#settingsDlg [data-close]').click();
  await expect(page.locator('#songMeta')).toContainText('Em · 100 bpm');
  await page.click('#backBtn');
  await expect(page.locator('.song-row .details').first()).toContainText('Em · 100 bpm');
});

test('in Edit, tapping a bar starts a new section there', async ({ page }) => {
  await openDemo(page);
  await page.click('#editBtn');
  await expect(page.locator('#editPanel')).toBeVisible();
  const surface = page.locator('#tab .at-surface');
  await expect(surface.locator('svg').first()).toBeVisible();
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
  page.on('request', (r) => { if (/accounts\.google\.com|apis\.google\.com|googleapis\.com\/drive/.test(r.url())) signIns.push(r.url()); });
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
  await expect(page.locator('#songMeta')).toContainText('Learning');
  await expect(page.locator('.cards > .role-note .role-note-text')).toHaveText('Check the key with the singer');
  await page.click('#backBtn');
  await expect(page.locator('.list-section', { hasText: 'Proposed' })).toHaveCount(0);
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
