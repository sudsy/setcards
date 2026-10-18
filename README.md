# Setcards

Guitar Pro songs as short section cards for every player in the band.

Most songs are built from a few short patterns played many times. Setcards finds those patterns in a Guitar Pro file and shows each one once, so a quick look on your phone before the song is enough. The whole song is still there, in order, whenever you need it.

## How it's organised

- **First open:** choose **With my band** (songs in a shared Google Drive folder) or **Just me, on this device**. It's asked once, and Settings can change it.
- **Home is the song list:** title, artist, key, tempo, length and number of sections for each song. Key and tempo come from the Guitar Pro file; when the file doesn't set a key it is estimated and shown with a "?", and anyone can correct it in the song's settings.
- **Songs before tab:** a song can be added with just a title, artist and YouTube link. Each song has a status: **Proposed**, **Learning** or **Ready**; proposed songs are listed separately. A song without tab opens on a short page with its video, notes and status, links to look for tab on Songsterr and Ultimate Guitar, and **Add the Guitar Pro file**, which keeps everything already noted.
- **Keys and transposing:** each song records three keys, shared with the band: the **original** (the recording), the key the **band plays in**, and the key the **tab is in** (estimated from the notes until someone sets it). Song settings explain how they differ, for example "The band plays this 2 semitones lower than the recording". The tab can be transposed **for the band** (shared) or **just for me** (this device only); **Match band key** works out the shift. Frets, chord names, notation and playback all move; notes that would fall below the lowest string go up an octave. The Guitar Pro file itself is never changed. A major key and its relative minor (G and Em) count as the same key when comparing.
- **Drafts:** in a band, a song you add can go straight to the band or stay on your device as a draft while you get it right. Drafts are listed separately, marked as only on this device, with **Share with band**.
- **Instrument notes:** notes are kept with the song, so they follow you to every device, and each instrument has its own: one for the whole song and one per part. The bass player's notes show in the bass view, the guitarist's in the guitar view.

## What it does

- **Song order:** the sections in sequence (Intro, Verse, Chorus…), always at the top.
- **Cards:** one card per part of the song. Each card shows how the part breaks into riffs, for example "D ×8" or "D ×4 · I ×3 · J". Each riff's tab and chords appear once, the first time the riff is used.
- **Full tab:** the normal Guitar Pro view, with section names, riff letters and chord names written above the bars.
- **One structure, a part for each player.** Pick what you play:
  - **Bass:** riff tab (chord names are hidden; **Show chords** in song settings turns them on)
  - **Guitar:** chord diagrams for the song, plus chords for each riff
  - **Vocals:** the song order, with how long each section is and the first words sung in it
  - **Keys and drums:** the riffs from their own track
- **Breaking a song down:** uses the section markers in the Guitar Pro file. If there are none, Setcards suggests sections from where the repeating pattern changes. In Edit you can rename sections (renaming one "Part A" renames them all), move them, set how many bars repeat, and use Find repeats to mark matching passages.
- **Chords:** tap a chord on a card to change it. By default the change applies every time that riff plays, so a guitarist only enters each progression once.
- **Playback:** play the whole song, loop a section, or loop a single riff, at 50% to 100% speed.
- **YouTube:** link a video and give sections start times. Picking a section jumps the video there.
- **Annotated Guitar Pro file:** download a copy of the .gp file with the sections, riff letters and chords written in.

## Where songs are kept

Setcards has no server. Songs come from one of these sources, and more can be added (see `js/storage.js`):

| Source | Who can see it | Can save changes |
| --- | --- | --- |
| **On this device** | Only you, in this browser | Yes |
| **Band folder (Google Drive)** | Everyone you share the Drive folder with | Yes, into the folder |
| **Shared with the app** (`songs/` folder in this repository) | Anyone who opens the app | Changes stay in each person's browser |

Notes (status, sections, chords, instrument notes, video) are saved as a small `.setcards.json` file per song, so the band shares one breakdown per song. A song without tab is just its notes file; once a Guitar Pro file is added, the notes name it (`tabFile`).

Once a band folder is connected, **Share invite link** in Songs gives a link that opens Setcards ready to join that folder: the bandmate signs in to Google and taps the folder.

The band folder also gets a **Song list** Google Sheet, kept up to date by Setcards, so anyone can see the band's songs (title, artist, status, key, tempo, length, YouTube link and tab file) without the app. It is rewritten only when one of those changes. Changes made in the sheet are not read back.

To use Google Drive, the person hosting this copy of the app sets it up once. See [SETUP-GOOGLE.md](SETUP-GOOGLE.md). It costs nothing: each band's files live in their own Google Drive.

## Running it

It is a static site with no build step. alphaTab is not stored in the repository, so fetch it once (needs Node.js), then serve the folder over http(s):

```
sh scripts/get-lib.sh
python3 -m http.server 8000
# open http://localhost:8000
```

### GitHub Pages

1. In the repository, open **Settings**, then **Pages**, and under "Build and deployment" set **Source** to **GitHub Actions**.
2. Every push to `main` runs `.github/workflows/pages.yml`, which adds alphaTab and publishes the site.
3. The app appears at `https://<user>.github.io/<repository>/`. On a phone, use "Add to Home Screen" and it also works offline.

Anything in `songs/` is public on a public repository. Use the Google Drive folder for songs you do not want to publish.

### Updates on phones

Each deploy stamps a version (the commit) into `sw.js` and `version.js`. An app added to the home screen checks for a new version whenever it is brought to the front, and refreshes onto it: straight away on the song list, or when going back to the list if a song is open. Band settings show the version that is running.

### Adding songs to the `songs/` folder

On GitHub, open the `songs` folder, choose **Add file**, then **Upload files**, and drop in the Guitar Pro file. Then edit `songs/index.json` and add a line for it:

```json
{ "file": "my-song.gp", "title": "My Song", "artist": "The Band" }
```

## Tests

```
npm install
npm run lib            # alphaTab, needed by the tests and the site
npm test               # unit tests: riff finding, section suggestions, lyric cues, chord shapes
npm run test:browser   # browser tests on a phone-sized screen, using the demo song
```

Every push to `main` runs both before publishing (`.github/workflows/pages.yml`). If a test fails, the site is not updated and the failure shows in the repository's **Actions** tab. Pull requests run the tests without publishing.

The browser tests stand in for Google sign-in and the Drive picker, since tests cannot sign in to Google, so those two steps still need a check by hand after changes to them.

## Files

- `index.html`, `styles.css`, `app.js`: the app
- `js/analysis.js`: finds repeating riffs and suggests sections (no browser code, testable with Node)
- `js/chords.js`: reads chord names and draws chord diagrams
- `js/storage.js`: the song sources (this device, the `songs/` folder, Google Drive)
- `config.js`: Google sign-in settings for this copy
- `demo.js`: a built-in practice song
- `lib/` (downloaded by `scripts/get-lib.sh`): [alphaTab](https://alphatab.net) 1.8.4 (MPL-2.0), which reads and draws Guitar Pro files, plus the Bravura music font (OFL) and the Sonivox soundfont
- `.github/workflows/pages.yml`: publishes the site to GitHub Pages
- `sw.js`, `manifest.webmanifest`, `icon.svg`: offline support and home screen icon
- `tests/unit`, `tests/browser`, `playwright.config.js`, `package.json`: the tests

## Ideas for later

- Full YouTube sync, with the tab cursor following the video (alphaTab supports this with sync points)
- Supabase or GitHub as further song sources
- Muting your own track to play along with the rest of the band
