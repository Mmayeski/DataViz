/**
 * Service Worker — enables offline caching for the DataViz PWA.
 */

const CACHE_NAME = 'dataviz-v1';
const ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/chart-manager.js',
    './js/chart-config.js',
    './js/proximity-sensor.js',
    './js/sensor-smoothing.js',
    './js/shake-sensor.js',
    './js/temperature-data.js',
    './js/tilt-sensor.js',
    './manifest.json',
    './icons/icon.svg',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cached) => {
            // Network-first for navigation, cache-first for assets.
            if (event.request.mode === 'navigate') {
                return fetch(event.request).catch(() => cached);
            }
            return cached || fetch(event.request);
        })
    );
});
