/* Shared pieces of the storage sources: the file names, the notes format helpers, the small key-value store
   on this device, and the overlay for edits to read-only songs. Loaded before the other storage files. */
(function (root) {
  'use strict';
  const SM = root.SM = root.SM || {};
  const NOTES_SUFFIX = '.setcards.json';
  const SONG_EXT = /\.(gp|gpx|gp[345]|xml|musicxml|mxl|capx)$/i;

  function emptyNotes(meta) {
    return { format: 'setcards/1', title: meta.title || '', artist: meta.artist || '', sections: null, chords: {}, youtubeUrl: '', updatedAt: 0 };
  }

  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } }
  };

  // Edits to songs in read-only sources, kept in this browser.
  const overlay = {
    get: (key) => ls.get('setcards:overlay:' + key),
    set: (key, notes) => ls.set('setcards:overlay:' + key, notes),
    clear: (key) => ls.del('setcards:overlay:' + key)
  };

  SM.storeCore = { NOTES_SUFFIX, SONG_EXT, emptyNotes, ls, overlay };
})(typeof window !== 'undefined' ? window : globalThis);
