# Song notes: the format

Each band song has a notes file in the band folder, named like the song with `.setcards.json` after it
(for example `Low Road.gp.setcards.json`). It holds what the band adds on top of the Guitar Pro file. The Guitar Pro
file itself is never changed by the notes.

The app and the notes tool both check notes with `js/notes.js`, so an edit made by either is checked the same way.

## Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `format` | `"setcards/1"` | Required. The format version. |
| `title`, `artist` | text | The song's name and artist, as the band wants them shown. |
| `status` | `proposed`, `learning` or `ready` | Where the song is in the band's list. |
| `sections` | list, or `null` | The song's sections. Each is `{ "id", "start", "name" }`, where `start` is the bar number counting from 0. Sections are in bar order and start at different bars. |
| `chords` | object | Chords for a bar. The key is the bar number counting from 0, the value is the chords as written, e.g. `"Dm7 G7"`. `"-"` means the bar has no chord. Chords are in the song's own key. |
| `capo` | 0 to 11 | The capo the chord shapes are played with. |
| `transpose` | -11 to 11 | Semitones the band plays the song from the tab's key. |
| `tempo` | number | Beats per minute, when the band has one. |
| `key`, `bandKey`, `originalKey`, `tabKey` | key names | The key the song is played in, and where it comes from. |
| `youtubeUrl` | text | A link to a recording. |
| `drumKit` | object | The drum kit the song uses, when it is not the default. |
| `drumFeel` | `{ "ms", "loud", "swell" }` | How the drums feel: timing offset in milliseconds, varied loudness, and rolls that swell. |
| `click` | `{ "countIn", "click" }` | Count-in before playing, and the click on drum-free bars. |
| `simile` | list of section start bars | Sections where repeated bass bars are shown with %. |
| `roleNotes` | object | Notes per instrument role, e.g. `{ "bass": { "song": "…", "parts": { "verse": "…" } } }`. |
| `audio`, `meta`, `tabFile`, `updatedAt` | — | Kept by the app: the attached audio, details worked out from the tab, the tab's file name, and when the notes were last changed (milliseconds). |

Any other field is reported as unknown, so a typo is caught rather than silently kept.

## Chart

`chart` holds the song's own chart, written by the chart editor (Edit on the chart view). Nothing is stored in the app for a new song, so the chart is empty until it is entered.

- `notes`: bass notes, keyed by bar number (0-based), space separated in the editor. `-` is a rest bar.
- `tags`: tags per bar number, a list of strings such as `Stab`, `Rest`, `Slide`, `Fill`, `Hit`, `Pickup`. A bar can have several. `Stab` gives the stab colour.
- `cues`: lyric cues, keyed by `section:k`, where `k` is the time the section is sung (1, 2, ...). Shared by bass and guitar.

Guitar charts use `chords` (the sounding chord per bar, as the cards store it) and do not use `chart.notes`.

## Editing with the tool

`scripts/notes-tool.mjs` reads and changes a notes file. Bar numbers count from 1, as the app shows them.

```
node scripts/notes-tool.mjs show     "Low Road.gp.setcards.json"
node scripts/notes-tool.mjs validate "Low Road.gp.setcards.json"
node scripts/notes-tool.mjs chord    "Low Road.gp.setcards.json" 1 "Dm7"
node scripts/notes-tool.mjs section  "Low Road.gp.setcards.json" 9 "Chorus"
node scripts/notes-tool.mjs unsection "Low Road.gp.setcards.json" 9
```

A change is written only if the notes are still valid afterwards. The tool exits with status 2 and lists the problems
if they are not. Edits to a file in the band folder should be made on a copy: download it, change it with the tool,
check it with `validate`, then upload it back.
