// Caches the app so it opens offline once visited (handy at rehearsal).
const CACHE = 'setcards-v2';
const FILES = [
  './', 'index.html', 'styles.css', 'app.js', 'demo.js', 'config.js', 'icon.svg', 'manifest.webmanifest',
  'js/analysis.js', 'js/chords.js', 'js/storage.js',
  'lib/alphaTab.min.js', 'lib/font/Bravura.woff2', 'lib/font/Bravura.woff', 'lib/font/Bravura.otf',
  'lib/soundfont/sonivox.sf2'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Network first so updates show up, cache when offline.
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
