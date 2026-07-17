/* ============================================================
   IKARO — Service Worker
   Strategia: pre-cache dell'app shell all'install, poi
   cache-first con aggiornamento in background (stale-while-
   revalidate). L'app è interamente statica e offline-first.
   ============================================================ */

const CACHE = 'ikaro-v9';

const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/variables.css',
  '/css/base.css',
  '/css/components.css',
  '/js/app.js',
  '/js/router.js',
  '/js/store.js',
  '/js/db.js',
  '/js/views/home.js',
  '/js/views/allenamento.js',
  '/js/views/scheda.js',
  '/js/views/nutrizione.js',
  '/js/views/aggiungi-alimento.js',
  '/js/views/progressi.js',
  '/js/views/profilo.js',
  '/js/components/bottom-nav.js',
  '/js/components/app-header.js',
  '/js/components/donut-chart.js',
  '/js/components/line-chart.js',
  '/js/components/workout-editor.js',
  '/js/components/ui.js',
  '/js/components/onboarding.js',
  '/assets/fonts/Jost-var.woff2',
  '/assets/icon-192.svg',
  '/assets/icon-512.svg',
  '/assets/icon-512-maskable.svg',
];

/* Install: pre-cache dell'app shell */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

/* Activate: pulizia delle cache di versioni precedenti */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Fetch: cache-first con revalidate in background (solo GET, stessa origin) */
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached); // offline: rimane la copia in cache

      // Navigazioni: fallback su index.html per la SPA
      if (request.mode === 'navigate') {
        return cached || network.catch(() => caches.match('/index.html'));
      }
      return cached || network;
    })
  );
});
