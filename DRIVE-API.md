# The band folder API

Every change to the band folder in Google Drive goes through one module: `js/drive-api.js`. The app uses it for the
browser, and `scripts/drive-tool.mjs` uses it from a terminal or by an agent. Both make the same calls in the same way.

## Operations

| Method | Does |
| --- | --- |
| `request(url, init)` | One call to Drive with the access token. A refusal throws an Error with `status`. |
| `getText(id)`, `getBytes(id)`, `getJson(id)` | Read a file's content. |
| `createFile(meta, body, type, fields)` | Create a file with its content. |
| `replaceMedia(id, body, type, {keepRevisionForever, fields})` | Replace a file's content. |
| `updateFile(id, changes, {addParents, removeParents, fields})` | Rename a file, or move it between folders. |
| `createFolder(name, parentId, fields)` | Make a folder. |
| `trashFile(id)` | Move a file to the trash. |

Notes files are checked with `js/notes.js` before they are written (see NOTES-FORMAT.md).

## The tool

```
export SETCARDS_DRIVE_TOKEN=<an access token for the band's Google account>
node scripts/drive-tool.mjs list FOLDER_ID
node scripts/drive-tool.mjs notes-get FILE_ID > notes.json
node scripts/drive-tool.mjs notes-put FILE_ID notes.json
node scripts/drive-tool.mjs rename FILE_ID "New name"
node scripts/drive-tool.mjs trash FILE_ID
```

The tool does not sign anyone in. The access token must be given to it. An expired token exits with status 3.

## Adding a write

A new write goes into `js/drive-api.js` as a method, with a test in `tests/unit/drive-api.test.mjs`. The app and the
tool then both get it. Writing to Drive from anywhere else is not allowed.
