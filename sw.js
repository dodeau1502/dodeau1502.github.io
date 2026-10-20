// Service Worker Minuit 01 — Mise en cache de la coque applicative pour un démarrage instantané sur mobile (PWA).
// Les flux vidéo et appels API tiers (TMDB, Stremio, AllDebrid, Supabase) passent toujours en direct sur le réseau.

const CACHE_NAME = 'minuit01-shell-v1.9';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Ne jamais intercepter les appels externes (API, flux vidéo, images distantes)
  if (url.origin !== self.location.origin) return;

  // Navigation HTML : réseau d'abord, repli sur le cache en cas de coupure
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req.url, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put('/index.html', copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match('/index.html') || caches.match('/')),
    );
    return;
  }

  // Ressources statiques de l'application (JS, CSS, polices, icônes) : Stale-While-Revalidate
  if (/\.(js|css|woff2?|png|svg|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => undefined);
            }
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      }),
    );
  }
});
