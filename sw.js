// Keeps a copy of the app so it opens offline (handy at rehearsal).
// The deploy workflow stamps VERSION with the commit, so every deploy is a new service worker: phones
// then install it, and the page refreshes itself onto the new version (see app.js).
const VERSION = '__SETCARDS_VERSION__';
const CACHE = 'setcards-' + VERSION;
const FILES = [
  './', 'index.html', 'styles.css', 'app.js', 'demo.js', 'config.js', 'version.js', 'icon.svg', 'manifest.webmanifest',
  'js/analysis.js', 'js/chords.js', 'js/storage.js',
  'lib/alphaTab.min.js', 'lib/font/Bravura.woff2', 'lib/font/Bravura.woff', 'lib/font/Bravura.otf',
  'lib/soundfont/sonivox.sf2'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Network first, checking with the server rather than the browser's short-term cache, so a new
  // version shows up straight away; the saved copy is used when offline.
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
