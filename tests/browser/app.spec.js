// End-to-end checks of the main flows, using the built-in demo song.
// Google sign-in and the Drive picker are replaced with stand-ins, since tests cannot sign in to Google.
const { test, expect } = require('@playwright/test');

async function openApp(page, path = '/') {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(path);
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 20000 });
  return errors;
}

const steps = (page) => page.locator('#structure .step');

test('opens on the demo song as cards, with the song order at the top', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.locator('#songTitle')).toHaveText('Low Road (demo)');
  await expect(steps(page)).toHaveText(['Whole song', 'Intro', 'Verse', 'Pre-chorus', 'Chorus', 'Verse', 'Pre-chorus', 'Chorus', 'Bridge', 'Chorus', 'Outro']);
  await expect(page.locator('.card-head h2')).toHaveText(['Intro', 'Verse', 'Pre-chorus', 'Chorus', 'Bridge', 'Outro']);
  await expect(page.locator('.mini-tab svg').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('nothing on the page is wider than a phone screen', async ({ page }) => {
  await openApp(page);
  const overflow = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth > window.innerWidth,
    scroller: document.getElementById('scroller').scrollWidth > document.getElementById('scroller').clientWidth
  }));
  expect(overflow).toEqual({ page: false, scroller: false });
});

test('tapping a section in the song order scrolls to its card', async ({ page }) => {
  await openApp(page);
  await steps(page).nth(4).click();
  await expect(page.locator('.card[data-group="chorus"]')).toBeInViewport();
});

test('the full tab shows one section at a time, or the whole song', async ({ page }) => {
  await openApp(page);
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
  await openApp(page);
  const verseCard = page.locator('.card[data-group="verse"]');
  await verseCard.locator('.chord-cell').first().click();
  await expect(page.locator('#chordAllLabel')).toContainText('Every time riff');
  await page.fill('#chordInput', 'Em');
  await expect(page.locator('#chordPreview svg')).toHaveCount(1);
  await page.click('#chordForm button[type=submit]');
  await expect(page.locator('#toast')).toContainText(/Chords set in \d+ bars/);
  await expect(verseCard.locator('.chord-cell').first()).toHaveText('Em');
  await page.reload();
  await expect(page.locator('.card[data-group="verse"] .chord-cell').first()).toHaveText('Em');
});

test('guitar shows chord diagrams and vocals shows the cue list', async ({ page }) => {
  await openApp(page);
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

test('in Edit, tapping a bar starts a new section there', async ({ page }) => {
  await openApp(page);
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

test('the Songs window steps aside while the Drive folder picker is open', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    SM.library.sources.drive.connect = async () => {
      window.dialogOpenDuringPicker = document.getElementById('libraryDlg').open;
      localStorage.setItem('setcards:driveFolder', JSON.stringify({ id: 'f1', name: 'Band songs' }));
      return { id: 'f1', name: 'Band songs' };
    };
  });
  await page.click('#libraryBtn');
  await page.click('#gPick');
  await expect(page.locator('#toast')).toContainText('Connected to “Band songs”');
  expect(await page.evaluate(() => window.dialogOpenDuringPicker)).toBe(false);
  await expect(page.locator('#libraryDlg')).toBeVisible();
  await expect(page.locator('#songLists')).toContainText('Show band songs');
});

test('opening the Songs window does not start a Google sign-in', async ({ page }) => {
  const signIns = [];
  page.on('request', (r) => { if (/accounts\.google\.com|apis\.google\.com|googleapis\.com\/drive/.test(r.url())) signIns.push(r.url()); });
  await page.addInitScript(() => localStorage.setItem('setcards:driveFolder', JSON.stringify({ id: 'f1', name: 'Band songs' })));
  await openApp(page);
  await page.click('#libraryBtn');
  await expect(page.locator('#songLists')).toContainText('Show band songs');
  expect(signIns).toEqual([]);
});

test('an invite link offers to join the named band folder', async ({ page }) => {
  await openApp(page, '/?band=folder123&name=The%20Band');
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
  expect(new URL(page.url()).search).toBe('');
});

test('a connected band folder can share an invite link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => {
    localStorage.setItem('setcards:driveFolder', JSON.stringify({ id: 'f9', name: 'Our Band' }));
    navigator.share = undefined;
  });
  await openApp(page);
  await page.click('#libraryBtn');
  await page.click('#gInvite');
  await expect(page.locator('#toast')).toContainText('Invite link copied');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const u = new URL(link);
  expect(u.searchParams.get('band')).toBe('f9');
  expect(u.searchParams.get('name')).toBe('Our Band');
});
