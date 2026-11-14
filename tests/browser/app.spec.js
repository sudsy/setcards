// End-to-end checks of the main flows, using the built-in demo song.
// Google sign-in and Drive are replaced with stand-ins, since tests cannot sign in to Google.
const { test, expect } = require('@playwright/test');

function watchErrors(page) {
  const errors = [];
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

// Picks the view: the top bar dropdown on wide screens, or the song settings on phones.
// Holds the pointer on an element for longer than a tap (a long press).

async function pickView(page, view) {
  if (await page.locator('#viewSelTop').isVisible()) {
    await page.selectOption('#viewSelTop', view);
  } else {
    await page.click('#settingsBtn');
    await page.selectOption('#viewSelSet', view);
    await page.click('#settingsDlg [data-close]');
  }
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
  // the details are saved once the song has been read, so wait for its first card before going back
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 20000 });
  await page.click('#backBtn');
  await expect(page.locator('#homeView')).toBeVisible();
  await expect(page.locator('.song-row .details').first()).toHaveText(/\?? · 104 bpm · 2:28 · 10 sections/);
  await page.reload();
  await expect(page.locator('#homeView')).toBeVisible();
});

test('picking a section in the cards sets playback to its beginning', async ({ page }) => {
  await openDemo(page);
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 20000 });
  const sections = page.locator('#structure .step:not(.whole)');
  expect(await sections.count()).toBeGreaterThan(2);
  await sections.nth(2).click();
  const s = await page.evaluate(() => window.setcardsTest.state());
  expect(s.playing).toBe(false);
  // alphaTab counts the first tick of a range one later than the part's own start, so one tick either way is the same place
  expect(Math.abs(s.range.start - s.parts[2].start)).toBeLessThanOrEqual(1);
  expect(Math.abs(s.tick - s.parts[2].start)).toBeLessThanOrEqual(1);
});

test('picking a section while playing restarts playback at that section', async ({ page }) => {
  await openDemo(page);
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#playBtn')).toBeEnabled({ timeout: 20000 });
  await page.click('#playBtn');
  await expect.poll(async () => (await page.evaluate(() => window.setcardsTest.state())).playing, { timeout: 10000 }).toBe(true);
  const sections = page.locator('#structure .step:not(.whole)');
  await sections.nth(1).click();
  const s = await page.evaluate(() => window.setcardsTest.state());
  expect(Math.abs(s.range.start - s.parts[1].start)).toBeLessThanOrEqual(1);
  await expect.poll(async () => (await page.evaluate(() => window.setcardsTest.state())).playing, { timeout: 10000 }).toBe(true);
  await page.click('#playBtn');
});

test('opens a song as cards, with the song order at the top', async ({ page }) => {
  const errors = watchErrors(page);
  await openDemo(page);
  // the full names show where they fit on one line, so this checks them on a wide screen
  await page.setViewportSize({ width: 1800, height: 900 });
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
  await pickView(page, 'tab');
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
  await page.click('#settingsBtn');
  await page.selectOption('#roleSel', { label });
  await page.click('#settingsDlg [data-close]');
  await expect(page.locator('#roleSel')).toHaveValue(new RegExp(label.toLowerCase()));
}

test('a chord typed in one bar stays in that bar unless every repeat is asked for', async ({ page }) => {
  await openDemo(page);
  await chooseRole(page, 'Guitar');
  const verseCard = page.locator('.card[data-group="verse"]');
  await verseCard.locator('.chord-cell').first().click();
  await expect(page.locator('#chordAll')).not.toBeChecked();
  await page.fill('#chordInput', 'Em');
  await page.click('#chordForm button[type=submit]');
  await expect(page.locator('#toast')).toContainText('Chords saved');
  await expect(verseCard.locator('.chord-cell').first()).toHaveText('Em');
});

test('several chords typed in a row each stay in their own bar', async ({ page }) => {
  await openDemo(page);
  await chooseRole(page, 'Guitar');
  const verseCard = page.locator('.card[data-group="verse"]');
  const chords = ['Am', 'F', 'C', 'G'];
  for (let i = 0; i < chords.length; i++) {
    await verseCard.locator('.chord-cell').nth(i).click();
    await page.fill('#chordInput', chords[i]);
    await page.click('#chordForm button[type=submit]');
    await expect(page.locator('#chordDlg')).toBeHidden();
  }
  // every bar keeps the chord typed for it, and no other bar changed
  for (let i = 0; i < chords.length; i++) {
    await expect(verseCard.locator('.chord-cell').nth(i)).toHaveText(chords[i]);
  }
  await page.reload();
  await page.locator('.song-row .song-open').first().click();
  for (let i = 0; i < chords.length; i++) {
    await expect(page.locator('.card[data-group="verse"] .chord-cell').nth(i)).toHaveText(chords[i]);
  }
});

test('chords entered on a riff apply to every repeat and survive a reload', async ({ page }) => {
  await openDemo(page);
  await chooseRole(page, 'Guitar');
  const verseCard = page.locator('.card[data-group="verse"]');
  await verseCard.locator('.chord-cell').first().click();
  await expect(page.locator('#chordAllLabel')).toContainText('Also in every repeat');
  await page.check('#chordAll');
  await page.fill('#chordInput', 'Em');
  await expect(page.locator('#chordPreview svg')).toHaveCount(1);
  await page.click('#chordForm button[type=submit]');
  await expect(page.locator('#toast')).toContainText(/Chords set in \d+ bars/);
  await expect(verseCard.locator('.chord-cell').first()).toHaveText('Em');
  await page.reload();
  await page.locator('.song-row .song-open').first().click();
  await expect(page.locator('.card[data-group="verse"] .chord-cell').first()).toHaveText('Em');
});

test('going back from a song returns to the list, and does not leave the app', async ({ page }) => {
  await openDemo(page);
  await expect(page.locator('#songView')).toBeVisible();
  // the browser's back gesture: back to the list, still in the app
  await page.goBack();
  await expect(page.locator('#homeView')).toBeVisible();
  await expect(page.locator('#songView')).toBeHidden();
  expect(new URL(page.url()).pathname).toBe('/');
  // the in-app back button does the same, and the song opens again
  await page.locator('.song-row .song-open', { hasText: 'Low Road (demo)' }).click();
  await expect(page.locator('#songView')).toBeVisible();
  await page.click('#backBtn');
  await expect(page.locator('#homeView')).toBeVisible();
});

test('song settings offer the default drum kit, and adding one', async ({ page }) => {
  await openDemo(page);
  await page.click('#settingsBtn');
  await expect(page.locator('#kitSel option').first()).toHaveText('Default kit');
  await expect(page.locator('#kitSel option').last()).toHaveText('Add a drum kit…');
  await expect(page.locator('#kitSel option').nth(1)).toHaveText('Built-in drums (no kit)');
  await page.keyboard.press('Escape');
});

test('the drum feel setting is kept', async ({ page }) => {
  await openDemo(page);
  await page.click('#settingsBtn');
  await page.locator('#drumFeel').fill('8');
  await page.locator('#drumFeel').dispatchEvent('change');
  await expect(page.locator('#drumFeelOut')).toHaveText('8 ms');
  // kept with the song, so it is still there after closing and reopening the settings
  await page.keyboard.press('Escape');
  await page.click('#settingsBtn');
  await expect(page.locator('#drumFeel')).toHaveValue('8');
  await page.keyboard.press('Escape');
});

test('the drums-only button is hidden for a song without a drum track', async ({ page }) => {
  await openDemo(page);
  // the demo has only a bass track, so there is nothing to solo
  await expect(page.locator('#drumsBtn')).toBeHidden();
});

test('the capo is chosen in the song settings, and the chart shows it under the title', async ({ page }) => {
  await openDemo(page);
  await chooseRole(page, 'Guitar');
  // a chord on the first bar, then the capo changes the shape shown for it
  const first = page.locator('.chord-cell').first();
  await first.click();
  await page.fill('#chordInput', 'Dm7');
  await page.click('#chordForm button[type=submit]');
  await expect(first).toHaveText('Dm7');
  const before = await first.textContent();
  await page.click('#settingsBtn');
  await page.selectOption('#capoSel', '2');
  await page.click('#settingsDlg [data-close]');
  await expect(first).not.toHaveText(before);
  await expect(page.locator('#songMeta')).not.toContainText('Capo');
  // the capo is kept with the song: it is still set after going back to the list
  await page.click('#backBtn');
  await page.locator('.song-row .song-open', { hasText: 'Low Road (demo)' }).click();
  await page.click('#settingsBtn');
  await expect(page.locator('#capoSel')).toHaveValue('2');
  await page.selectOption('#capoSel', '0');
  await page.click('#settingsDlg [data-close]');
  await expect(first).toHaveText(before);
  // the chart shows the capo as text under the title, and only in the chart view
  await page.click('#settingsBtn');
  await page.selectOption('#capoSel', '2');
  await page.click('#settingsDlg [data-close]');
  await pickView(page, 'chart');
  await expect(page.locator('#chartStatus')).toHaveText('Capo 2 · Chord diagrams on');
  await pickView(page, 'tab');
  await expect(page.locator('#chartStatus')).toBeHidden();
});

test('the capo is only offered to guitar, not bass', async ({ page }) => {
  await openDemo(page);
  await chooseRole(page, 'Bass');
  await page.click('#settingsBtn');
  await expect(page.locator('#capoSel')).toBeHidden();
  await page.click('#settingsDlg [data-close]');
  await chooseRole(page, 'Guitar');
  await page.click('#settingsBtn');
  await expect(page.locator('#capoSel')).toBeVisible();
  await page.click('#settingsDlg [data-close]');
});

test('the click in drum-free bars is a side stick on the first beat, and is left out of an export', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => localStorage.setItem('setcards:prefs', JSON.stringify({ mode: 'solo' })));
  await page.goto('/');
  await page.click('#addSongBtn');
  await page.fill('#addTitle', 'Drums and Click');
  await page.click('#addForm button[type=submit]');
  const alphaTab = await import('@coderline/alphatab');
  const imp = new alphaTab.importer.AlphaTexImporter();
  // bar 1 has four drum hits; bars 2 and 3 have none
  imp.initFromString('\\title "Drums and Click"\n\\track "Drums"\n\\instrument percussion\n.\n:4 36 42 38 42 | :1 r | :1 r |', new alphaTab.Settings());
  const bytes = new alphaTab.exporter.Gp7Exporter().export(imp.readScore(), new alphaTab.Settings());
  await page.locator('#attachInput').setInputFiles({ name: 'drums-click.gp', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
  await expect.poll(() => page.evaluate(() => window.setcardsTest.state().bars.length), { timeout: 20000 }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.setcardsTest.state().sideSticks)).toBe(0);
  await page.click('#settingsBtn');
  await page.check('#clickBars');
  await expect.poll(() => page.evaluate(() => window.setcardsTest.state().sideSticks)).toBe(2);
  await page.uncheck('#clickBars');
  await expect.poll(() => page.evaluate(() => window.setcardsTest.state().sideSticks)).toBe(0);
  await page.check('#clickBars');
  await expect.poll(() => page.evaluate(() => window.setcardsTest.state().sideSticks)).toBe(2);
  // the export has the drums as they were written: four hits, and no side sticks
  const download = page.waitForEvent('download');
  await page.click('#exportBtn');
  const file = await download;
  const fs = require('fs');
  const copy = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(fs.readFileSync(await file.path())), new alphaTab.Settings());
  const hits = copy.tracks[0].staves[0].bars.map((b) => b.voices[0].beats.filter((x) => x.notes.length).length);
  expect(hits).toEqual([4, 0, 0]);
  expect(errors).toEqual([]);
});

test('in guitar edit mode, the chords for the whole song are typed in one box per bar and saved together', async ({ page }) => {
  const errors = watchErrors(page);
  await openDemo(page);
  await chooseRole(page, 'Guitar');
  await expect(page.locator('.card-chords')).toHaveCount(0);
  // one section in the chord panel for each section of the song, a repeated section listed once
  const cardNames = await page.locator('#cards .card .card-head h2').allTextContents();
  const songSections = await page.evaluate(() => window.setcardsTest.state().groups);
  await page.click('#editBtn');
  const panelNames = await page.locator('#chordPanelBody section.section > h2').allTextContents();
  expect(panelNames.length).toBe(songSections);
  // the cards show every section too, so chords entered for a section can be seen on its card
  expect(cardNames.length).toBe(panelNames.length);
  await expect(page.locator('#chordPanel')).toBeVisible();
  await expect(page.locator('#sectionEdit')).toBeHidden();
  await expect(page.locator('#cards')).toBeHidden();
  // the chord sheet fills the screen below the header and above the play bar
  const fill = await page.evaluate(() => {
    const panel = document.getElementById('editPanel').getBoundingClientRect();
    const bar = document.querySelector('.playerbar');
    return { panel: panel.height, screen: window.innerHeight, bar: bar && bar.getBoundingClientRect().top };
  });
  expect(fill.panel).toBeGreaterThan(fill.screen * 0.6);
  if (fill.bar) expect(fill.panel).toBeLessThanOrEqual(fill.bar + 1);
  await expect(page.locator('#chordPanelSave')).toBeDisabled();
  // Enter moves on to the next bar
  await page.getByLabel('Bar 1 chords').fill('Dm7');
  await page.getByLabel('Bar 1 chords').press('Enter');
  await expect(page.getByLabel('Bar 2 chords')).toBeFocused();
  await page.getByLabel('Bar 2 chords').fill('Gm7');
  await page.getByLabel('Bar 3 chords').fill('Xq');
  await expect(page.locator('#chordPanelCount')).toHaveText('3 unsaved bars');
  await expect(page.getByLabel('Bar 3 chords')).toHaveClass(/clash/);
  await expect(page.getByLabel('Bar 1 chords')).toHaveClass(/changed/);
  // discard puts the boxes back
  await page.click('#chordPanelDiscard');
  await expect(page.getByLabel('Bar 1 chords')).not.toHaveValue('Dm7');
  // type two bars and save them together
  await page.getByLabel('Bar 1 chords').fill('Dm7');
  await page.getByLabel('Bar 2 chords').fill('Gm7');
  await page.click('#chordPanelSave');
  await expect(page.locator('#toast')).toContainText('Chords saved in 2 bars');
  await expect(page.getByLabel('Bar 1 chords')).toHaveValue('Dm7');
  await expect(page.locator('#chordPanelCount')).toHaveText('No changes');
  // the saved chords are there after leaving and coming back to edit
  await page.click('#chordPanelDone');
  await expect(page.locator('#chordPanel')).toBeHidden();
  await expect(page.locator('#cards')).toBeVisible();
  // the saved chords show on the cards
  await expect(page.locator('#cards')).toContainText('Dm7');
  await page.click('#editBtn');
  await expect(page.getByLabel('Bar 1 chords')).toHaveValue('Dm7');
  await expect(page.getByLabel('Bar 2 chords')).toHaveValue('Gm7');
  expect(errors).toEqual([]);
});

test('picking a section in the full tab scrolls to it and keeps the rest of the tab', async ({ page }) => {
  await openDemo(page);
  await chooseRole(page, 'Bass');
  await pickView(page, 'tab');
  await page.click('#nextBtn');
  await page.click('#nextBtn');
  await page.click('#nextBtn');
  await expect.poll(() => page.evaluate(() => window.setcardsTest.state().scroll)).toBeGreaterThan(0);
  await page.click('#prevBtn');
  await page.click('#prevBtn');
  await page.click('#prevBtn');
  await expect(page.locator('#sectionName')).toHaveText('Whole song');
  // the top of the tab (its padding is a few pixels)
  await expect.poll(() => page.evaluate(() => window.setcardsTest.state().scroll)).toBeLessThan(40);
});

test('the play bar has back to the beginning and no loop button', async ({ page }) => {
  await openDemo(page);
  await expect(page.locator('#loopBtn')).toHaveCount(0);
  await expect(page.locator('#skipBtn')).toBeVisible();
  await chooseRole(page, 'Bass');
  await pickView(page, 'tab');
  await page.click('#nextBtn');
  await page.click('#nextBtn');
  await page.click('#skipBtn');
  const start = await page.evaluate(() => window.setcardsTest.state().parts[1].playStart ?? window.setcardsTest.state().parts[1].start);
  // alphaTab numbers a range one tick later, so a tick either side is the start
  await expect.poll(() => page.evaluate(() => Math.abs(window.setcardsTest.state().tick - window.setcardsTest.state().parts[1].start))).toBeLessThanOrEqual(1);
});

test('the chart view is empty until the chart is entered in the editor, and then shows its notes', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => localStorage.setItem('setcards:prefs', JSON.stringify({ mode: 'solo', view: 'chart' })));
  await page.goto('/');
  await page.click('#addSongBtn');
  await page.fill('#addTitle', 'Baby I Love You');
  await page.click('#addForm button[type=submit]');
  const alphaTab = await import('@coderline/alphatab');
  // the bass part, with the sections of the song as written (the chart takes its notes from the band's data)
  const bar = (f) => `${f}.4.8`;
  const sec = (name, n, f) => Array.from({ length: n }, (_, i) => (i === 0 ? `\\section "${name}" ` : '') + bar(f(i))).join(' |\n');
  const tex = ['\\title "Baby I Love You"', '.', '\\track "Bass"', '\\instrument 33', '.',
    sec('Intro', 2, () => 5), '|', sec('Verse', 8, () => 5), '|', sec('Pre-chorus', 6, () => 5), '|',
    sec('Chorus', 7, () => 5), '|', sec('Outro', 9, () => 5), '|'].join('\n');
  const imp = new alphaTab.importer.AlphaTexImporter();
  imp.initFromString(tex, new alphaTab.Settings());
  const bytes = new alphaTab.exporter.Gp7Exporter().export(imp.readScore(), new alphaTab.Settings());
  await page.locator('#attachInput').setInputFiles({ name: 'baby.gp', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
  await expect(page.locator('#chart .chart-card').first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#chart .chart-card')).toHaveCount(5);
  // nothing is built in: the bars are empty and the chart has no notes until they are entered
  const intro = page.locator('#chart .chart-card').first();
  await expect(intro.locator('.chart-cell')).toHaveCount(2);
  await expect(intro.locator('.chart-cell').first()).toHaveText('');
  await expect(page.locator('#chart .card-lines .layout').first().locator('.when')).toHaveText('Intro');
  // the pencil on the chart opens the editor; Done saves the notes into this song
  await page.click('#editBtn');
  await expect(page.locator('#chartEditor')).toBeVisible();
  await expect(page.locator('#chartEditor h1')).toHaveText('Edit chart');
  await page.locator('#chartEditor .ce-sec').first().locator('.ce-in').fill('G G');
  await page.click('#chartEditor [data-ce=done]');
  await expect(page.locator('#chartEditor')).toBeHidden();
  await expect(intro.locator('.chart-cell')).toHaveText(['G', 'G']);
  await expect(page.locator('#viewSelTop')).toHaveValue('chart');
  expect(errors).toEqual([]);
});

test('tapping a bar in the chart opens its tab for bass, and its chord diagram for guitar', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => localStorage.setItem('setcards:prefs', JSON.stringify({ mode: 'solo', view: 'chart' })));
  await page.goto('/');
  await page.click('#addSongBtn');
  await page.fill('#addTitle', 'Baby I Love You');
  await page.click('#addForm button[type=submit]');
  const alphaTab = await import('@coderline/alphatab');
  const sec = (name, n) => Array.from({ length: n }, (_, i) => (i === 0 ? `\\section "${name}" ` : '') + '5.4.8').join(' |\n');
  const tex = ['\\title "Baby I Love You"', '.', '\\track "Bass"', '\\instrument 33', '.', sec('Intro', 2), '|', sec('Verse', 8), '|'].join('\n');
  const imp = new alphaTab.importer.AlphaTexImporter();
  imp.initFromString(tex, new alphaTab.Settings());
  const bytes = new alphaTab.exporter.Gp7Exporter().export(imp.readScore(), new alphaTab.Settings());
  await page.locator('#attachInput').setInputFiles({ name: 'baby.gp', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
  await expect(page.locator('#chart .chart-card').first()).toBeVisible({ timeout: 20000 });
  // a short tap opens the bar, with its tab for bass
  const bassCell = page.locator('#chart .chart-card').nth(1).locator('.chart-cell').nth(2);
  await bassCell.click();
  await expect(page.locator('#barPeekDlg')).toBeVisible();
  await expect(page.locator('#barPeekTitle')).toHaveText('Bar 5');
  await expect(page.locator('#barPeekBody .bar-peek-tab')).toBeVisible();
  await page.click('#barPeekDlg [data-close]');
  // guitar: the tap shows the chord diagram for the bar, and the diagrams toggle follows the setting
  await pickView(page, 'chart');
  await chooseRole(page, 'Guitar');
  await expect(page.locator('#chartStatus')).toHaveText('No capo · Chord diagrams on');
  await page.locator('#chart .chart-card').first().locator('.chart-cell').first().click();
  await expect(page.locator('#barPeekDlg')).toBeVisible();
  await expect(page.locator('#barPeekTitle')).toHaveText('Bar 1');
  await page.click('#barPeekDlg [data-close]');
  await page.click('#settingsBtn');
  await page.uncheck('#showChords');
  await page.click('#settingsDlg [data-close]');
  await expect(page.locator('#chartStatus')).toHaveText('No capo · Chord diagrams off');
  await page.click('#settingsBtn');
  await expect(page.locator('#showChords')).not.toBeChecked();
  await page.locator('#settingsDlg [data-close]').click();
  expect(errors).toEqual([]);
});

test('guitar shows chord diagrams and vocals shows the cue list', async ({ page }) => {
  await openDemo(page);
  await chooseRole(page, 'Guitar');
  await page.locator('.card[data-group="verse"] .chord-cell').first().click();
  await page.fill('#chordInput', 'Em C');
  await page.click('#chordForm button[type=submit]');
  await expect(page.locator('.diagram-strip .chord-svg')).toHaveCount(2);

  await chooseRole(page, 'Vocals');
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

  await chooseRole(page, 'Guitar');
  await expect(page.locator('.card[data-group="verse"] .role-note')).toHaveCount(0);

  await chooseRole(page, 'Bass');
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
  await expect(page.locator('#structure .step[data-label="Solo"]')).toHaveCount(1);
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
  await expect(page.locator('#songMeta')).toHaveText('The Demos');
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
  await expect.poll(() => page.evaluate(() => window.setcardsTest.state().wholeNote)).toBe('Check the key with the singer');
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
  await pickView(page, 'tab');
  await expect(page.locator('#tab .at-surface svg').first()).toBeVisible();
  await expect(page.locator('#tab text', { hasText: 'Intro' }).first()).toBeVisible();
  await expect(page.locator('#tab text', { hasText: /^Em$/ })).toHaveCount(0);

  await page.click('#settingsBtn');
  await expect(page.locator('#showChords')).not.toBeChecked();
  await page.check('#showChords');
  await page.locator('#settingsDlg [data-close]').click();
  await expect(page.locator('#tab text', { hasText: /^Em$/ }).first()).toBeVisible();
  await pickView(page, 'cards');
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
  await pickView(page, 'tab');
  const firstFrets = () => page.evaluate(() => [...document.querySelectorAll('#tab text')].map((t) => t.textContent).filter((t) => /^\d+$/.test(t)).slice(1, 4).join(' '));
  await expect(page.locator('#tab .at-surface svg').first()).toBeVisible();
  const before = await firstFrets();

  // for the band: up 2
  await page.click('#settingsBtn');
  await page.click('#bandTrUp');
  await page.click('#bandTrUp');
  await expect(page.locator('#bandTrOut')).toHaveText('+2');
  await page.locator('#settingsDlg [data-close]').click();
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

test('a band song opens read only until signed in to Google, and opening it does not ask again', async ({ page }) => {
  const errors = watchErrors(page);
  await fakeDrive(page, { signedIn: false });
  await page.addInitScript(() => {
    window.fakeSavedSongs = [{ id: 'b1', title: 'Saved Song', artist: 'Band', notes: { title: 'Saved Song' }, hasTab: true, addedAt: 1 }];
    window.fakeBandSongs = [{ id: 'b1', title: 'Saved Song', artist: 'Band', notes: { title: 'Saved Song' }, hasTab: true, addedAt: 1 }];
  });
  await page.goto('/');
  await page.locator('.song-row .song-open', { hasText: 'Saved Song' }).click();
  await expect(page.locator('body')).toHaveClass(/read-only/);
  expect(errors).toEqual([]);
});

test('a band song can be edited once signed in to Google', async ({ page }) => {
  await fakeDrive(page, { signedIn: true });
  await page.addInitScript(() => {
    window.fakeSavedSongs = [{ id: 'b1', title: 'Saved Song', artist: 'Band', notes: { title: 'Saved Song' }, hasTab: true, addedAt: 1 }];
    window.fakeBandSongs = [{ id: 'b1', title: 'Saved Song', artist: 'Band', notes: { title: 'Saved Song' }, hasTab: true, addedAt: 1 }];
  });
  await page.goto('/');
  await page.locator('.song-row .song-open', { hasText: 'Saved Song' }).click();
  await expect(page.locator('body')).not.toHaveClass(/read-only/);
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
    const verse = page.locator('#structure .step[data-label="Verse"]').first();
    expect(Number(await verse.getAttribute('data-bars'))).toBeGreaterThan(0);
    // a tap on a later part slides its card into view, no scrolling needed
    const cards = page.locator('#cards');
    await page.locator('#structure .step[data-label="Outro"]').click();
    await expect.poll(() => cards.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    await expect(page.locator('#structure .step[data-label="Outro"]')).toHaveClass(/in-view/);
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
  const intro = page.locator('#structure .step[data-label="Intro"]');
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

test('in guitar edit mode, the chords can be filled from a tab part and saved', async ({ page }) => {
  const errors = watchErrors(page);
  await openDemo(page);
  await chooseRole(page, 'Guitar');
  await page.click('#editBtn');
  await expect(page.locator('#tabPartList .tab-part').first()).toBeVisible();
  await expect(page.locator('#tabPartList .tab-part[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('#chordPanelSave')).toBeDisabled();
  await page.click('#fillFromTabBtn');
  await expect(page.locator('#chordPanelCount')).toContainText('unsaved');
  const filled = await page.evaluate(() => Array.from(document.querySelectorAll('#chordPanelBody input[data-bar]')).filter((i) => i.value.trim()).length);
  expect(filled).toBeGreaterThan(4);
  await page.click('#chordPanelSave');
  await expect(page.locator('#toast')).toContainText('Chords saved');
  // listening plays the picked part, and Stop puts the song back
  await page.click('#listenBtn');
  await expect(page.locator('#listenBtn')).toHaveAttribute('aria-pressed', 'true');
  // the metronome clicks while the part is listened to
  await expect.poll(() => page.evaluate(() => window.setcardsTest.state().metronome)).toBeGreaterThan(0);
  await page.click('#listenBtn');
  await expect(page.locator('#listenBtn')).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => page.evaluate(() => window.setcardsTest.state().metronome)).toBe(0);
  // alphaTab's audio reports stopping a source that has not started, which the test browser's silent audio can cause
  expect(errors.filter((e) => !/cannot call stop without calling start first/.test(e))).toEqual([]);
});

test('the display mode is remembered for each song, on this device', async ({ page }) => {
  const errors = watchErrors(page);
  await openDemo(page);
  await pickView(page, 'chart');
  await page.goto('/');
  // a second song starts in the view it is opened in, then keeps its own view
  await page.click('#addSongBtn');
  await page.fill('#addTitle', 'Second Song');
  await page.click('#addForm button[type=submit]');
  const added = page.locator('.song-row .song-open', { hasText: 'Second Song' });
  if (await added.isVisible()) await added.click();
  await expect(page.locator('#songTitle')).toHaveText('Second Song');
  await pickView(page, 'cards');
  await page.click('#backBtn');
  await page.locator('.song-row .song-open', { hasText: 'Low Road (demo)' }).click();
  await expect(page.locator('#viewSelTop')).toHaveValue('chart');
  await page.click('#backBtn');
  await page.locator('.song-row .song-open', { hasText: 'Second Song' }).click();
  await expect(page.locator('#viewSelTop')).toHaveValue('cards');
  // it is kept in this browser, so it is still there after a reload
  await page.reload();
  await page.locator('.song-row .song-open', { hasText: 'Low Road (demo)' }).click();
  await expect(page.locator('#viewSelTop')).toHaveValue('chart');
  expect(errors).toEqual([]);
});

test('the song title and artist can be changed in the settings, and go back to the file when cleared', async ({ page }) => {
  const errors = watchErrors(page);
  await openDemo(page);
  await page.click('#settingsBtn');
  await page.fill('#songTitleInput', 'Low Road, live');
  await page.fill('#songArtistInput', 'The Band');
  await page.locator('#songArtistInput').press('Tab');
  await page.click('#settingsDlg [data-close]');
  await expect(page.locator('#songTitle')).toHaveText('Low Road, live');
  await expect(page.locator('#songMeta')).toContainText('The Band');
  await page.click('#settingsBtn');
  await page.fill('#songTitleInput', '');
  await page.locator('#songTitleInput').press('Tab');
  await page.click('#settingsDlg [data-close]');
  await expect(page.locator('#songTitle')).toHaveText('Low Road (demo)');
  expect(errors).toEqual([]);
});

// the chart on the phone sizes people use: nothing spills sideways, the boxes stay in their cards, and the play button floats in view
for (const [w, h] of [[375, 667], [393, 852], [430, 932]]) {
  test(`the chart fits a ${w} by ${h} phone, with the play button floating over it`, async ({ page }) => {
    const errors = watchErrors(page);
    await openDemo(page);
    await chooseRole(page, 'Guitar');
    await pickView(page, 'chart');
    await page.setViewportSize({ width: w, height: h });
    await expect(page.locator('#chart .chart-card').first()).toBeVisible();
    await expect(page.locator('#chart')).not.toContainText('for the whole song');
    await expect(page.locator('#loading')).toBeHidden();
    await expect(page.locator('body')).toHaveClass(/compact/);
    const r = await page.evaluate(() => {
      // every section's boxes sit on one line, and the cards run close to the screen edges
      const oneLine = [...document.querySelectorAll('#chart .chart-card')].every((card) => new Set([...card.querySelectorAll('.chart-cell')].map((c) => Math.round(c.getBoundingClientRect().top))).size <= 1);
      const cardLeft = Math.min(...[...document.querySelectorAll('#chart .chart-card')].map((c) => c.getBoundingClientRect().left));
      const spilled = [...document.querySelectorAll('#chart .chart-card')].filter((card) => {
        const cr = card.getBoundingClientRect();
        return [...card.querySelectorAll('.chart-cell')].some((c) => { const b = c.getBoundingClientRect(); return b.right > cr.right + 1 || b.left < cr.left - 1; });
      }).length;
      const pb = document.getElementById('playBtn').getBoundingClientRect();
      return { oneLine, cardLeft, overflowX: document.documentElement.scrollWidth - window.innerWidth, spilled, playInView: pb.bottom <= window.innerHeight && pb.right <= window.innerWidth && pb.left >= 0 && pb.width > 0 };
    });
    expect(r.overflowX).toBeLessThanOrEqual(0);
    expect(r.oneLine).toBe(true);
    expect(r.cardLeft).toBeLessThanOrEqual(12);
    expect(r.spilled).toBe(0);
    expect(r.playInView).toBe(true);
    // ⋯ opens the other playback controls as a sheet, and closes again
    await page.click('#moreBtn');
    await expect(page.locator('#speedSel')).toBeVisible();
    await page.click('#moreBtn');
    await expect(page.locator('#speedSel')).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test('an artist typed in the settings is kept when the settings close, even with the field still focused', async ({ page }) => {
  const errors = watchErrors(page);
  await openDemo(page);
  await page.click('#settingsBtn');
  await page.fill('#songArtistInput', 'Typed Artist');
  // closing the sheet without leaving the field (as on a phone, where a button tap does not move focus)
  await page.evaluate(() => document.getElementById('settingsDlg').close());
  await expect(page.locator('#songMeta')).toContainText('Typed Artist');
  // the artist is saved with the song's notes, so it is still there after the song is reopened
  await expect.poll(() => page.evaluate(() => window.setcardsTest.state().artistNote)).toBe('Typed Artist');
  await page.click('#settingsBtn');
  await expect(page.locator('#songArtistInput')).toHaveValue('Typed Artist');
  await page.evaluate(() => document.getElementById('settingsDlg').close());
  expect(errors).toEqual([]);
});

// Switching songs and instruments while the chart editor is in use: the editor never shows or saves another song's chart.
test('the chart editor closes when another song is opened, and each song keeps its own chart', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => localStorage.setItem('setcards:prefs', JSON.stringify({ mode: 'solo' })));
  await page.goto('/');
  await page.locator('#addDemoBtn').click();
  await page.click('#addSongBtn');
  await page.fill('#addTitle', 'Second Song');
  await page.click('#addForm button[type=submit]');
  await page.locator('#attachInput').setInputFiles(await demoGpFile());
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 20000 });
  // back to the list (the system back, as the editor covers the page's own back button later)
  await page.evaluate(() => history.back());
  await expect(page.locator('.song-row .song-open', { hasText: 'Low Road (demo)' })).toBeVisible();

  // first song: start editing, type into the first section, and leave without pressing Done
  await page.locator('.song-row .song-open', { hasText: 'Low Road (demo)' }).click();
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 20000 });
  await pickView(page, 'chart');
  await page.click('#editBtn');
  await expect(page.locator('#chartEditor')).toBeVisible();
  await page.locator('#chartEditor .ce-sec').first().locator('.ce-in').fill('G G');
  await page.evaluate(() => history.back());
  await expect(page.locator('#chartEditor')).toBeHidden();
  await expect(page.locator('.song-row .song-open', { hasText: 'Second Song' })).toBeVisible();

  // second song: its editor starts empty, not with the first song's draft
  await page.locator('.song-row .song-open', { hasText: 'Second Song' }).click();
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 20000 });
  await pickView(page, 'chart');
  await page.click('#editBtn');
  await expect(page.locator('#chartEditor .ce-sec').first().locator('.ce-in')).toHaveValue(/^\s*$/);
  await page.locator('#chartEditor .ce-sec').first().locator('.ce-in').fill('D D');
  await page.click('#chartEditor [data-ce=done]');
  await expect(page.locator('#chartEditor')).toBeHidden();
  await expect(page.locator('#chart .chart-card').first().locator('.chart-cell').first()).toHaveText('D');

  // back to the first song: its chart is still empty, and the second song's notes were not written into it
  await page.evaluate(() => history.back());
  await page.locator('.song-row .song-open', { hasText: 'Low Road (demo)' }).click();
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 20000 });
  await pickView(page, 'chart');
  await expect(page.locator('#chart .chart-card').first().locator('.chart-cell').first()).toHaveText('');
  await expect(page.locator('#chart')).not.toContainText('D');
  expect(errors).toEqual([]);
});

test('the chart editor offers the fields for the instrument in use', async ({ page }) => {
  const errors = watchErrors(page);
  await openDemo(page);
  await chooseRole(page, 'Guitar');
  await pickView(page, 'chart');
  await page.click('#editBtn');
  await expect(page.locator('#chartEditor .ce-lbl', { hasText: 'Real chords (sounding)' }).first()).toBeVisible();
  await page.click('#chartEditor [data-ce=back]');
  await expect(page.locator('#chartEditor')).toBeHidden();
  expect(errors).toEqual([]);
});

// Set lists (on this device; the band folder version is kept in the same format)
test('a set list is made, ordered and changed on the set view, and kept after a reload', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => { if (!localStorage.getItem('setcards:prefs')) localStorage.setItem('setcards:prefs', JSON.stringify({ mode: 'solo' })); });
  await page.goto('/');
  await page.locator('#addDemoBtn').click();
  await page.click('#addSongBtn');
  await page.fill('#addTitle', 'Second Song');
  await page.click('#addForm button[type=submit]');
  await expect(page.locator('#noTab h2')).toHaveText('No tab yet');
  await page.evaluate(() => history.back());
  await expect(page.locator('.song-row .song-open', { hasText: 'Low Road (demo)' })).toBeVisible();

  // the Set lists switch shows the set lists, which start empty
  await page.click('#tabSets');
  await expect(page.locator('#setlistsWrap')).toBeVisible();
  await expect(page.locator('#songListWrap')).toBeHidden();
  await expect(page.locator('#setlistsWrap')).toContainText('No set lists yet');

  // a new set list opens in edit mode: name it, then tick its songs
  await page.click('#addSongBtn');
  await expect(page.locator('#setlistView')).toBeVisible();
  await page.fill('#slNameIn', 'Friday gig');
  await page.locator('#slNameIn').press('Tab');
  await page.locator('.sl-pick', { hasText: 'Low Road (demo)' }).click();
  await page.locator('.sl-pick', { hasText: 'Second Song' }).click();
  await page.click('#setlistView [data-sl=done]');

  // the set view lists the songs in the order they were added; the second is moved up
  await expect(page.locator('#setlistView .sl-songs li')).toHaveCount(2);
  await expect(page.locator('#setlistView .sl-songs li').first()).toContainText('Low Road (demo)');
  await page.locator('#setlistView [data-sl=up][data-i="1"]').click();
  await expect(page.locator('#setlistView .sl-songs li').first()).toContainText('Second Song');

  // the song with no tab is shown as such
  await expect(page.locator('#setlistView .sl-songs li').first()).toContainText('No tab yet');

  // changes are saved when the set view is left, so leave it, then reload: the set list is still there, in the same order
  await page.click('#setlistView [data-sl=back]');
  await page.reload();
  await expect(page.locator('#setlistsWrap .setlist-row')).toContainText('Friday gig');
  await page.locator('#setlistsWrap .setlist-row', { hasText: 'Friday gig' }).click();
  await expect(page.locator('#setlistView .sl-songs li').first()).toContainText('Second Song');
  await page.click('#setlistView [data-sl=back]');
  await expect(page.locator('#setlistsWrap')).toBeVisible();
  await page.click('#tabSongs');
  await expect(page.locator('#songListWrap')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a set list can be duplicated and deleted', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => { if (!localStorage.getItem('setcards:prefs')) localStorage.setItem('setcards:prefs', JSON.stringify({ mode: 'solo', homeTab: 'sets' })); });
  await page.goto('/');
  await page.click('#addSongBtn');
  await page.fill('#slNameIn', 'Practice');
  await page.locator('#slNameIn').press('Tab');
  await page.click('#setlistView [data-sl=done]');
  await page.click('#setlistView [data-sl=dup]');
  await expect(page.locator('#setlistView h1')).toHaveText('Practice copy');
  await page.click('#setlistView [data-sl=back]');
  await expect(page.locator('#setlistsWrap .setlist-row')).toHaveCount(2);

  // deleting asks once, then deletes on the second tap
  await page.locator('#setlistsWrap .setlist-row', { hasText: 'Practice copy' }).click();
  await page.click('#setlistView [data-sl=del]');
  await expect(page.locator('#setlistView [data-sl=del]')).toHaveText('Tap again to delete');
  await page.click('#setlistView [data-sl=del]');
  await expect(page.locator('#setlistView')).toBeHidden();
  await expect(page.locator('#setlistsWrap .setlist-row')).toHaveCount(1);
  expect(errors).toEqual([]);
});

// The band's song list on a phone: after the server sync adds Delete to each row, nothing is wider than the screen, even with long titles.
test.describe('the band song list on a phone', () => {
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625 });
  test('stays the width of the screen after the sync, with long titles', async ({ page }) => {
    await fakeDrive(page);
    const notes = (title, artist, key, n) => ({ format: 'setcards/1', title, artist, status: 'learning', tempo: 120, sections: Array.from({ length: n }, (_, i) => ({ id: `x${i}`, start: i * 4, name: `Part ${i + 1}` })), chords: {}, meta: { key, tempo: 120 }, updatedAt: 1 });
    const long = 'A very long song title that keeps going well past the width of the phone screen';
    const songs = [
      { id: 's1', title: 'Autumn-Leaves', artist: 'Eva Cassidy', fileName: 'a.gp', hasTab: true, addedAt: 1, updatedAt: 1, order: 0, notes: notes('Autumn-Leaves', 'Eva Cassidy', 'Bbm', 6) },
      { id: 's2', title: long, artist: 'A band with a long name too', fileName: 'b.gp', hasTab: true, addedAt: 2, updatedAt: 2, order: 1, notes: notes(long, 'A band with a long name too', 'Eb', 8) }
    ];
    await page.addInitScript((songs) => {
      window.fakeBandSongs = songs;
      window.fakeSavedSongs = songs.map((s) => ({ ...s, savedAt: Date.now() }));
      // the server answer is held back, so the saved copy is what shows first
      window.fakeListWait = new Promise((r) => { window.releaseSync = r; });
    }, songs);
    await page.goto('/');
    await expect(page.locator('.song-row')).toHaveCount(2);
    await page.evaluate(() => window.releaseSync());
    await expect(page.locator('.song-row').first().locator('.song-del')).toBeVisible();
    const wide = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - innerWidth,
      rows: [...document.querySelectorAll('#songListWrap .song-row')].filter((r) => r.getBoundingClientRect().right > innerWidth + 1).length
    }));
    expect(wide.page).toBeLessThanOrEqual(0);
    expect(wide.rows).toBe(0);
  });
});

// Set lists in a band: they are kept on the phone, and go to the band's folder only on a normal refresh.
test('a band set list is kept on the phone, goes to the band folder on refresh, and shows without a connection', async ({ page }) => {
  const errors = watchErrors(page);
  await fakeDrive(page);
  await page.addInitScript(() => {
    window.fakeBandSongs = [{ id: 's1', title: 'Autumn-Leaves', artist: 'Eva Cassidy', fileName: 'a.gp', hasTab: true, addedAt: 1, updatedAt: 1, order: 0, notes: { format: 'setcards/1', title: 'Autumn-Leaves', artist: 'Eva Cassidy', sections: [], chords: {}, updatedAt: 1 } }];
  });
  await page.goto('/');
  await expect(page.locator('.song-row')).toHaveCount(1);
  // the band folder's set list calls are stood in for: they record what would be sent
  await page.evaluate(() => {
    const sl = SM.library.sources.drive.setlists;
    window.sent = [];
    window.fakeOffline = false;
    window.folderFiles = new Map();
    sl.write = async (id, list) => { if (window.fakeOffline) throw new Error('offline'); const fid = id || `drv-${window.folderFiles.size + 1}`; window.sent.push(list.name); window.folderFiles.set(fid, list); return fid; };
    sl.list = async () => { if (window.fakeOffline) throw new Error('offline'); return [...window.folderFiles].map(([id, list]) => ({ id, list })); };
  });
  await page.click('#tabSets');
  await page.click('#addSongBtn');
  await page.fill('#slNameIn', 'Gig');
  await page.locator('#slNameIn').press('Tab');
  await page.locator('.sl-pick', { hasText: 'Autumn-Leaves' }).click();
  await page.click('#setlistView [data-sl=done]');
  await page.click('#setlistView [data-sl=back]');
  // the set list is on the phone at once, and nothing has gone to the band folder yet
  await expect(page.locator('#setlistsWrap .setlist-row')).toContainText('Gig');
  await expect(page.locator('#setlistsWrap .setlist-row')).toContainText('Not sent to the band yet');
  expect(await page.evaluate(() => window.sent.length)).toBe(0);

  // a normal refresh sends it to the band folder
  await page.click('#syncBtn');
  await expect.poll(() => page.evaluate(() => window.sent.join(','))).toBe('Gig');
  await expect(page.locator('#setlistsWrap .setlist-row')).toContainText('Kept on this phone and in the band folder');

  // without a connection the set lists still show, and changes wait for the next refresh
  await page.evaluate(() => { window.fakeOffline = true; });
  await page.click('#tabSongs');
  await page.click('#tabSets');
  await expect(page.locator('#setlistsWrap .setlist-row')).toContainText('Gig');
  await page.locator('#setlistsWrap .setlist-row', { hasText: 'Gig' }).click();
  await page.click('#setlistView [data-sl=edit]');
  await page.locator('.sl-pick', { hasText: 'Autumn-Leaves' }).click();
  await page.click('#setlistView [data-sl=done]');
  await page.click('#setlistView [data-sl=back]');
  await expect(page.locator('#setlistsWrap .setlist-row')).toContainText('0 songs');
  await expect(page.locator('#setlistsWrap .setlist-row')).toContainText('Not sent to the band yet');
  expect(errors).toEqual([]);
});

test('tapping a song in a set list opens it the same way as the song list', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => { if (!localStorage.getItem('setcards:prefs')) localStorage.setItem('setcards:prefs', JSON.stringify({ mode: 'solo' })); });
  await page.goto('/');
  await page.locator('#addDemoBtn').click();
  await page.click('#tabSets');
  await page.click('#addSongBtn');
  await page.fill('#slNameIn', 'Gig');
  await page.locator('#slNameIn').press('Tab');
  await page.locator('.sl-pick', { hasText: 'Low Road (demo)' }).click();
  await page.click('#setlistView [data-sl=done]');
  await page.click('#setlistView [data-sl=back]');
  await page.locator('#setlistsWrap .setlist-row', { hasText: 'Gig' }).click();
  await page.locator('#setlistView .sl-open', { hasText: 'Low Road (demo)' }).click();
  await expect(page.locator('#setlistView')).toBeHidden();
  await expect(page.locator('#songTitle')).toHaveText('Low Road (demo)');
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 20000 });
  expect(errors).toEqual([]);
});


// The main screen asks Google quietly again on a refresh when the sign-in has run out (no pop-up, no tap needed).
test('the main screen asks Google quietly on a refresh, and shows the band’s songs when it answers', async ({ page }) => {
  const errors = watchErrors(page);
  await fakeDrive(page, { signedIn: false });
  await page.addInitScript(() => {
    window.fakeBandSongs = [{ id: 's1', title: 'Autumn-Leaves', artist: 'Eva Cassidy', fileName: 'a.gp', hasTab: true, addedAt: 1, updatedAt: 1, order: 0, notes: { format: 'setcards/1', title: 'Autumn-Leaves', artist: 'Eva Cassidy', sections: [], chords: {}, updatedAt: 1 } }];
  });
  await page.goto('/');
  await expect(page.locator('#bandBox')).toBeVisible();
  // Google is stood in for: it answers quietly, so the token is there and the songs show
  await page.evaluate(() => {
    const d = SM.library.sources.drive;
    window.nowSigned = false;
    window.quietCalls = 0;
    d.signedIn = () => window.nowSigned;
    d.signInSilently = async () => { window.quietCalls++; window.nowSigned = true; return true; };
  });
  await page.click('#syncBtn');
  await expect(page.locator('.song-row')).toHaveCount(1);
  expect(await page.evaluate(() => window.quietCalls)).toBe(1);
  expect(errors).toEqual([]);
});

test('going back from a song opened from a set list returns to that set list', async ({ page }) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => { if (!localStorage.getItem('setcards:prefs')) localStorage.setItem('setcards:prefs', JSON.stringify({ mode: 'solo' })); });
  await page.goto('/');
  await page.locator('#addDemoBtn').click();
  await page.click('#tabSets');
  await page.click('#addSongBtn');
  await page.fill('#slNameIn', 'Gig');
  await page.locator('#slNameIn').press('Tab');
  await page.locator('.sl-pick', { hasText: 'Low Road (demo)' }).click();
  await page.click('#setlistView [data-sl=done]');
  await page.click('#setlistView [data-sl=back]');
  await page.locator('#setlistsWrap .setlist-row', { hasText: 'Gig' }).click();
  await page.locator('#setlistView .sl-open', { hasText: 'Low Road (demo)' }).click();
  await expect(page.locator('#songTitle')).toHaveText('Low Road (demo)');
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 20000 });
  // back from the song returns to the set list it came from, not the song list
  await page.click('#backBtn');
  await expect(page.locator('#setlistView')).toBeVisible();
  await expect(page.locator('#setlistView h1')).toHaveText('Gig');
  expect(errors).toEqual([]);
});


// An edit made while Google Drive cannot be reached is kept on the device, and shows again once the connection is back.
test('an edit made offline is kept, and is still there after reconnecting', async ({ page }) => {
  const errors = watchErrors(page);
  await fakeDrive(page);
  await page.addInitScript(() => {
    window.fakeBandSongs = [{ id: 's1', title: 'Autumn-Leaves', artist: 'Old Artist', fileName: 'a.gp', hasTab: false, addedAt: 1, updatedAt: 1, order: 0, notes: { format: 'setcards/1', title: 'Autumn-Leaves', artist: 'Old Artist', sections: [], chords: {}, updatedAt: 1 } }];
  });
  await page.goto('/');
  await expect(page.locator('.song-row')).toHaveCount(1);
  await page.locator('.song-row .song-open').first().click();
  await expect(page.locator('#songTitle')).toHaveText('Autumn-Leaves');
  // the connection drops: saving to Drive fails
  await page.evaluate(() => {
    const d = SM.library.sources.drive;
    window.realSave = d.saveNotes;
    d.saveNotes = async () => { throw new Error('offline'); };
  });
  await page.click('#settingsBtn');
  await page.fill('#songArtistInput', 'Offline Edit');
  await page.locator('#songArtistInput').press('Tab');
  await page.click('#settingsDlg [data-close]');
  await expect(page.locator('#songMeta')).toContainText('Offline Edit');
  // the save to Drive has been tried and has failed: the edit is kept on this device
  await expect.poll(() => page.evaluate(() => localStorage.getItem('setcards:overlay:drive:s1') || ''), { timeout: 10000 }).toContain('Offline Edit');
  // the connection returns; the edit should now reach the band's copy, without anything else being done
  await page.evaluate(() => { SM.library.sources.drive.saveNotes = window.realSave; window.dispatchEvent(new Event('online')); });
  await expect.poll(() => page.evaluate(() => window.fakeBandSongs[0].notes.artist), { timeout: 10000 }).toBe('Offline Edit');
  await page.click('#backBtn');
  await expect(page.locator('.song-row .song-open').first()).toBeVisible();
  await page.locator('.song-row .song-open').first().click();
  await page.click('#settingsBtn');
  await expect(page.locator('#songArtistInput')).toHaveValue('Offline Edit');
  expect(errors).toEqual([]);
});

// An edit is kept on the phone at once, before it has been sent to the band's folder.
test('an edit is kept on the phone at once, before the band’s folder has it', async ({ page }) => {
  const errors = watchErrors(page);
  await fakeDrive(page);
  await page.addInitScript(() => {
    window.fakeBandSongs = [{ id: 's1', title: 'Autumn-Leaves', artist: 'Old Artist', fileName: 'a.gp', hasTab: false, addedAt: 1, updatedAt: 1, order: 0, notes: { format: 'setcards/1', title: 'Autumn-Leaves', artist: 'Old Artist', sections: [], chords: {}, updatedAt: 1 } }];
  });
  await page.goto('/');
  await page.locator('.song-row .song-open').first().click();
  await expect(page.locator('#songTitle')).toHaveText('Autumn-Leaves');
  // the band's folder never answers, so nothing reaches it
  await page.evaluate(() => { SM.library.sources.drive.saveNotes = () => new Promise(() => {}); });
  await page.click('#settingsBtn');
  await page.fill('#songArtistInput', 'Phone Edit');
  await page.locator('#songArtistInput').press('Tab');
  await page.click('#settingsDlg [data-close]');
  // well before the few-second delay for the band's folder, the phone has it
  await expect.poll(() => page.evaluate(() => localStorage.getItem('setcards:overlay:drive:s1') || ''), { timeout: 1500 }).toContain('Phone Edit');
  expect(await page.evaluate(() => window.fakeBandSongs[0].notes.artist)).toBe('Old Artist');
  // and it is still there after a reload
  await page.reload();
  await page.locator('.song-row .song-open').first().click();
  await page.click('#settingsBtn');
  await expect(page.locator('#songArtistInput')).toHaveValue('Phone Edit');
  expect(errors).toEqual([]);
});

// The band changed the song while an edit here was not sent yet: the phone's edit is shown, the band's version is kept.
test('a song changed in the band and on this phone is flagged, and the band’s version is kept', async ({ page }) => {
  const errors = watchErrors(page);
  await fakeDrive(page);
  await page.addInitScript(() => {
    window.fakeBandSongs = [{ id: 's1', title: 'Autumn-Leaves', artist: 'Old Artist', fileName: 'a.gp', hasTab: false, addedAt: 1, updatedAt: 1, order: 0, notes: { format: 'setcards/1', title: 'Autumn-Leaves', artist: 'Old Artist', sections: [], chords: {}, updatedAt: 1 } }];
  });
  await page.goto('/');
  await page.locator('.song-row .song-open').first().click();
  await expect(page.locator('#songTitle')).toHaveText('Autumn-Leaves');
  // a first edit reaches the band, so the phone knows the band's copy
  await page.click('#settingsBtn');
  await page.fill('#songArtistInput', 'First Edit');
  await page.locator('#songArtistInput').press('Tab');
  await page.click('#settingsDlg [data-close]');
  await expect.poll(() => page.evaluate(() => window.fakeBandSongs[0].notes.artist)).toBe('First Edit');
  // then the connection drops, and an edit here is not sent
  await page.evaluate(() => { SM.library.sources.drive.saveNotes = () => Promise.reject(new Error('offline')); });
  await page.click('#settingsBtn');
  await page.fill('#songArtistInput', 'Phone Edit');
  await page.locator('#songArtistInput').press('Tab');
  await page.click('#settingsDlg [data-close]');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('setcards:overlay:drive:s1') || ''), { timeout: 10000 }).toContain('Phone Edit');
  // meanwhile someone changes the song in the band's folder
  await page.evaluate(() => {
    window.fakeBandSongs[0].notes = { ...window.fakeBandSongs[0].notes, artist: 'Band Edit', updatedAt: Date.now() + 60000 };
    SM.library.sources.drive.saveNotes = window.realSaveForConflict || SM.library.sources.drive.saveNotes;
  });
  // the song is opened again: the phone's edit shows, with a warning, and the band's version is kept on the phone
  await page.click('#backBtn');
  await page.locator('.song-row .song-open').first().click();
  // the later change (the band's) is shown, and both versions are kept on the phone
  await expect(page.locator('#songMeta')).toContainText('Band Edit');
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('setcards:conflict:drive:s1') || 'null'));
  expect(kept.local.artist).toBe('Phone Edit');
  expect(kept.remote.artist).toBe('Band Edit');
  await expect(page.locator('#noticeText')).toContainText('at the same time');
  expect(errors).toEqual([]);
});

// Field by field: a title changed here and an artist changed in the band's folder are both kept, with no conflict.
test('a change to a different field on each side is merged, not flagged', async ({ page }) => {
  const errors = watchErrors(page);
  await fakeDrive(page);
  await page.addInitScript(() => {
    window.fakeBandSongs = [{ id: 's1', title: 'Autumn-Leaves', artist: 'Old Artist', fileName: 'a.gp', hasTab: false, addedAt: 1, updatedAt: 1, order: 0, notes: { format: 'setcards/1', title: 'Autumn-Leaves', artist: 'Old Artist', sections: [], chords: {}, updatedAt: 1 } }];
  });
  await page.goto('/');
  await page.locator('.song-row .song-open').first().click();
  await expect(page.locator('#songTitle')).toHaveText('Autumn-Leaves');
  // an edit reaches the band, so the phone knows the band's copy
  await page.click('#settingsBtn');
  await page.fill('#songArtistInput', 'First Edit');
  await page.locator('#songArtistInput').press('Tab');
  await page.click('#settingsDlg [data-close]');
  await expect.poll(() => page.evaluate(() => window.fakeBandSongs[0].notes.artist)).toBe('First Edit');
  // then the connection drops, and the title is changed here
  await page.evaluate(() => { SM.library.sources.drive.saveNotes = () => Promise.reject(new Error('offline')); });
  await page.click('#settingsBtn');
  await page.fill('#songTitleInput', 'Phone Title');
  await page.locator('#songTitleInput').press('Tab');
  await page.click('#settingsDlg [data-close]');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('setcards:overlay:drive:s1') || ''), { timeout: 10000 }).toContain('Phone Title');
  // meanwhile the artist is changed in the band's folder
  await page.evaluate(() => {
    window.fakeBandSongs[0].notes = { ...window.fakeBandSongs[0].notes, artist: 'Band Artist', updatedAt: Date.now() + 60000 };
  });
  await page.click('#backBtn');
  await page.locator('.song-row .song-open').first().click();
  // both changes are shown, and nothing is flagged
  await expect(page.locator('#songMeta')).toContainText('Band Artist');
  await page.click('#settingsBtn');
  await expect(page.locator('#songTitleInput')).toHaveValue('Phone Title');
  await page.click('#settingsDlg [data-close]');
  await expect(page.locator('#noticeText')).toHaveText('');
  expect(await page.evaluate(() => localStorage.getItem('setcards:conflict:drive:s1'))).toBeNull();
  expect(errors).toEqual([]);
});

// a song changed here (not sent) and in the band's folder: sets that up, and leaves the notices open on it
async function conflictSetup(page) {
  await fakeDrive(page);
  await page.addInitScript(() => {
    window.fakeBandSongs = [{ id: 's1', title: 'Autumn-Leaves', artist: 'Old Artist', fileName: 'a.gp', hasTab: false, addedAt: 1, updatedAt: 1, order: 0, notes: { format: 'setcards/1', title: 'Autumn-Leaves', artist: 'Old Artist', sections: [], chords: {}, updatedAt: 1 } }];
  });
  await page.goto('/');
  await page.locator('.song-row .song-open').first().click();
  await expect(page.locator('#songTitle')).toHaveText('Autumn-Leaves');
  await page.click('#settingsBtn');
  await page.fill('#songArtistInput', 'First Edit');
  await page.locator('#songArtistInput').press('Tab');
  await page.click('#settingsDlg [data-close]');
  await expect.poll(() => page.evaluate(() => window.fakeBandSongs[0].notes.artist)).toBe('First Edit');
  await page.evaluate(() => { SM.library.sources.drive.saveNotes = () => Promise.reject(new Error('offline')); });
  await page.click('#settingsBtn');
  await page.fill('#songArtistInput', 'Phone Edit');
  await page.locator('#songArtistInput').press('Tab');
  await page.click('#settingsDlg [data-close]');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('setcards:overlay:drive:s1') || ''), { timeout: 10000 }).toContain('Phone Edit');
  await page.evaluate(() => {
    window.fakeBandSongs[0].notes = { ...window.fakeBandSongs[0].notes, artist: 'Band Edit', updatedAt: Date.now() + 60000 };
  });
  await page.click('#backBtn');
  await page.locator('.song-row .song-open').first().click();
  await expect(page.locator('#songMeta')).toContainText('Band Edit');
  await page.evaluate(() => document.getElementById('noticeDlg').showModal());
  await expect(page.locator('#conflictBox .conflict-list li').first()).toHaveText('Artist');
  // the band can be written to again, so the chosen version can be sent
  await page.evaluate(() => { SM.library.sources.drive.saveNotes = async (id, notes) => { window.fakeBandSongs.find((x) => x.id === id).notes = notes; }; });
}

test('a conflict can be settled by using the band’s version of the changed fields', async ({ page }) => {
  const errors = watchErrors(page);
  await conflictSetup(page);
  await page.locator('#conflictBox button', { hasText: 'Use the band’s versions' }).click();
  await expect(page.locator('#songMeta')).toContainText('Band Edit');
  expect(await page.evaluate(() => localStorage.getItem('setcards:conflict:drive:s1'))).toBeNull();
  expect(await page.evaluate(() => window.fakeBandSongs[0].notes.artist)).toBe('Band Edit');
  expect(errors).toEqual([]);
});

test('a conflict can be settled by using this phone’s version, which then reaches the band', async ({ page }) => {
  const errors = watchErrors(page);
  await conflictSetup(page);
  await page.locator('#conflictBox button', { hasText: 'Use my versions' }).click();
  await expect(page.locator('#songMeta')).toContainText('Phone Edit');
  expect(await page.evaluate(() => localStorage.getItem('setcards:conflict:drive:s1'))).toBeNull();
  await expect.poll(() => page.evaluate(() => window.fakeBandSongs[0].notes.artist)).toBe('Phone Edit');
  expect(errors).toEqual([]);
});


// Undo and redo in the edit panel: a change is undone and redone, the song is shown again, and edit mode stays on.
test('undo and redo step back and forth through the changes to a song', async ({ page }) => {
  const errors = watchErrors(page);
  await openDemo(page);
  await expect(page.locator('#songTitle')).toHaveText('Low Road (demo)');
  await page.click('#settingsBtn');
  await page.fill('#songTitleInput', 'Changed once');
  await page.locator('#songTitleInput').press('Tab');
  await page.click('#settingsDlg [data-close]');
  await expect(page.locator('#songTitle')).toHaveText('Changed once');
  await page.click('#editBtn');
  await expect(page.locator('#undoBtn')).toBeEnabled();
  await expect(page.locator('#redoBtn')).toBeDisabled();
  await page.click('#undoBtn');
  await expect(page.locator('#songTitle')).toHaveText('Low Road (demo)');
  await expect(page.locator('body')).toHaveClass(/editing/);
  await expect(page.locator('#redoBtn')).toBeEnabled();
  await page.click('#redoBtn');
  await expect(page.locator('#songTitle')).toHaveText('Changed once');
  await expect(page.locator('#redoBtn')).toBeDisabled();
  expect(errors).toEqual([]);
});

// Undo and redo in the chart editor work on the draft, before Done.
test('the chart editor can undo and redo its changes before Done', async ({ page }) => {
  const errors = watchErrors(page);
  await openDemo(page);
  await pickView(page, 'chart');
  await page.click('#editBtn');
  await expect(page.locator('#chartEditor')).toBeVisible();
  const first = page.locator('#chartEditor .ce-sec').first().locator('.ce-in');
  await first.fill('G G');
  await expect(page.locator('#chartEditor [data-ce=undo]')).toBeEnabled();
  await page.click('#chartEditor [data-ce=undo]');
  await expect(first).toHaveValue(/^\s*$/);
  await expect(page.locator('#chartEditor [data-ce=redo]')).toBeEnabled();
  await page.click('#chartEditor [data-ce=redo]');
  await expect(first).toHaveValue(/^G G\s*$/);
  // nothing is saved until Done, so Back leaves the chart as it was
  await page.click('#chartEditor [data-ce=back]');
  await expect(page.locator('#chartEditor')).toBeHidden();
  expect(errors).toEqual([]);
});

// The section strip is the same in every view: full names when they fit on one line, letters when they do not.
test('the section strip is the same in every view, and the view can be chosen on a phone', async ({ page }) => {
  const errors = watchErrors(page);
  await openDemo(page);
  const labels = () => page.locator('#structure .step:not(.whole)').allTextContents();
  await page.setViewportSize({ width: 1800, height: 900 });
  await pickView(page, 'cards');
  const cards = await labels();
  await pickView(page, 'chart');
  expect(await labels()).toEqual(cards);
  await pickView(page, 'tab');
  expect(await labels()).toEqual(cards);
  expect(cards.every((t) => t.length > 1)).toBe(true);   // full names where they fit on one line
  // a phone: the view can be chosen from the top bar, and the strip is letters or full names, never a mix
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#viewSelTop')).toBeVisible();
  await page.selectOption('#viewSelTop', 'chart');
  await expect(page.locator('#chart')).toBeVisible();
  const phone = await labels();
  expect(phone.every((t) => t.length === 1) || phone.every((t) => t.length > 1)).toBe(true);
  expect(errors).toEqual([]);
});
