// TOEIC Quest Service Worker
// Cache strategy:
//   - App shell (HTML/CSS/JS/icons): cache-first, pre-cached on install
//   - Data (CSV, images đề): network-first with cache fallback
//   - Audio (B2 bucket, external): network-only (too large to cache 2GB)

const CACHE_NAME = 'toeic-quest-v27';
const RUNTIME_CACHE = 'toeic-runtime-v27';

// Pre-cache on install (app shell)
const APP_SHELL = [
  '/',
  '/index.html',
  '/test.html',
  '/tests.html',
  '/quick.html',
  '/roadmap.html',
  '/study.html',
  '/drill.html',
  '/notes.html',
  '/dictation.html',
  '/part2.html',
  '/mistakes.html',
  '/login.html',
  '/profile.html',
  '/grammar.html',
  '/vocabulary.html',
  '/blog.html',
  '/css/style.css?v=11',
  '/js/state.js?v=11',
  '/js/catalog.js?v=10',
  '/js/layout.js?v=12',
  '/js/csv.js?v=10',
  '/js/quiz-core.js?v=10',
  '/js/study-core.js?v=1',
  '/js/vocab-notes.js?v=5',
  '/js/firebase-init.js?v=1',
  '/js/auth.js?v=1',
  '/favicon.ico',
  '/favicon.png',
  '/favicon.svg',
  '/img/mascot.png',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/img/apple-touch-icon.png',
  '/manifest.json'
];

// Install: pre-cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL).catch(err => {
        // Don't fail install if some files missing
        console.warn('[SW] Pre-cache partial failure:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET
  if (req.method !== 'GET') return;

  // Skip B2 audio (too large, ~2GB total — không cache)
  if (url.hostname === 'f005.backblazeb2.com') {
    return; // network-only by default
  }

  // Let the browser/network handle Google Fonts + Firebase (SDK/Auth/Firestore) directly — never cache
  if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com') ||
      url.hostname.endsWith('firebaseio.com') || url.hostname.endsWith('firebaseapp.com')) {
    return;
  }

  // Same-origin requests
  if (url.origin === self.location.origin) {
    // HTML pages (incl. home "/"): network-first with cache fallback.
    // Checked BEFORE app-shell so page content updates always reach users;
    // precached copies in APP_SHELL still serve when offline.
    if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
      event.respondWith(networkFirst(req));
      return;
    }

    // App shell assets (CSS/JS/icons): cache-first
    if (APP_SHELL.includes(url.pathname) || APP_SHELL.includes(url.pathname + url.search)) {
      event.respondWith(cacheFirst(req));
      return;
    }

    // Data files (CSV, images đề): stale-while-revalidate
    if (url.pathname.startsWith('/data/') || url.pathname.endsWith('.csv')) {
      event.respondWith(staleWhileRevalidate(req));
      return;
    }

    // Default: cache-first
    event.respondWith(cacheFirst(req));
  }
});

// Strategies
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return cached || new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    return cached || caches.match('/index.html');
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}

// Message handler để client trigger update
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
