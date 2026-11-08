/* Set lists: an ordered list of songs for a gig or a practice. Pure: no storage, no screen.

   A set list is stored as JSON, one file per set list in the band's "Set lists" folder (or on this device in
   solo use):
     { format: 'setcards-setlist/1', name, songs: [{ key, title, artist }], updatedAt }
   Each song is held by its library key ("drive:<id>", "local:<id>"), with its title and artist kept so the list
   still reads well if the song is missing. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};
  const FORMAT = 'setcards-setlist/1';
  const SUFFIX = '.setlist.json';
  const DEFAULT_NAME = 'New set list';

  const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 80);

  // A new, empty set list.
  const blank = (name, now = Date.now()) => ({ format: FORMAT, name: clean(name) || DEFAULT_NAME, songs: [], updatedAt: now });

  const has = (list, key) => list.songs.some((s) => s.key === key);

  // The song is added at the end. A song is in a set once, so adding it again changes nothing.
  function add(list, song) {
    if (!song || !song.key || has(list, song.key)) return list;
    return { ...list, songs: [...list.songs, { key: song.key, title: clean(song.title), artist: clean(song.artist) }] };
  }

  function remove(list, key) {
    return { ...list, songs: list.songs.filter((s) => s.key !== key) };
  }

  // Moves the song at index up (delta -1) or down (delta 1). Moving past either end changes nothing.
  function move(list, index, delta) {
    const to = index + delta;
    if (index < 0 || to < 0 || index >= list.songs.length || to >= list.songs.length) return list;
    const songs = list.songs.slice();
    [songs[index], songs[to]] = [songs[to], songs[index]];
    return { ...list, songs };
  }

  // Reads a stored set list. Anything that is not a set list gives null, so a damaged file is skipped, not shown.
  function parse(text) {
    let d;
    try { d = typeof text === 'string' ? JSON.parse(text) : text; } catch (e) { return null; }
    if (!d || d.format !== FORMAT || !Array.isArray(d.songs)) return null;
    const songs = d.songs
      .filter((s) => s && typeof s.key === 'string' && s.key)
      .map((s) => ({ key: s.key, title: clean(s.title), artist: clean(s.artist) }));
    // the same song listed twice keeps its first place
    const seen = new Set();
    return {
      format: FORMAT,
      name: clean(d.name) || DEFAULT_NAME,
      songs: songs.filter((s) => (seen.has(s.key) ? false : seen.add(s.key))),
      updatedAt: Number(d.updatedAt) || 0
    };
  }

  const serialise = (list) => JSON.stringify({ format: FORMAT, name: list.name, songs: list.songs, updatedAt: list.updatedAt }, null, 2);

  // The file name for a set list, without characters a file system refuses.
  const fileNameFor = (name) => `${clean(name).replace(/[\\/:*?"<>|]/g, '').trim() || 'Set list'}${SUFFIX}`;

  // The songs in a set, with what the band can do with each: missing from the library, or no tab to play.
  function resolve(list, songsByKey) {
    return list.songs.map((s) => {
      const song = songsByKey.get(s.key);
      return { ...s, missing: !song, playable: !!song && song.hasTab !== false };
    });
  }

  SM.setlists = { FORMAT, SUFFIX, DEFAULT_NAME, blank, add, remove, move, has, parse, serialise, fileNameFor, resolve };
})(typeof window !== 'undefined' ? window : globalThis);
