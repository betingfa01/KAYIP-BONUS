/*
 * FA01 Kayıp Bonus Hesaplayıcı — Service Worker
 *
 * Strategy:
 *  - Navigations (the HTML page): network-first, falling back to the cached
 *    copy when offline, so users always get the latest deploy when online.
 *  - Static assets (icons, logo, manifest): stale-while-revalidate — served
 *    instantly from cache, refreshed in the background for next time.
 *  - Old cache versions are deleted on activate (cache invalidation).
 *  - Cross-origin and non-GET requests are never intercepted.
 *
 * Bump CACHE_VERSION any time a precached file's content changes, so
 * returning users are guaranteed to pick up the new version.
 */
'use strict';

var CACHE_VERSION = 'fa01-kayip-bonus-v1';

var PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './fa01-logo.jpg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(function (cache) {
        return cache.addAll(PRECACHE_URLS);
      })
      .then(function () {
        return self.skipWaiting();
      })
      .catch(function (err) {
        // A precache miss must never block installation — the app still
        // works fully online, and normal navigation will fill the cache.
        console.warn('SW precache failed:', err);
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) { return key !== CACHE_VERSION; })
            .map(function (key) { return caches.delete(key); })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

function networkFirst(request) {
  return fetch(request)
    .then(function (response) {
      if (response && response.ok) {
        var copy = response.clone();
        caches.open(CACHE_VERSION).then(function (cache) {
          cache.put(request, copy).catch(function () {});
        });
      }
      return response;
    })
    .catch(function () {
      return caches.match(request).then(function (cached) {
        return cached || caches.match('./index.html');
      });
    });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then(function (cached) {
    var networkFetch = fetch(request)
      .then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE_VERSION).then(function (cache) {
            cache.put(request, copy).catch(function () {});
          });
        }
        return response;
      })
      .catch(function () {
        return cached;
      });
    return cached || networkFetch;
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;

  // Only handle same-origin GET requests; let everything else pass through
  // untouched (this app makes no cross-origin or non-GET requests anyway).
  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
