// Service worker for the online app: keeps the app's files so it opens offline.
// - The app's own files: from the network when it answers, else from the cache.
// - The Firebase scripts: from the cache first, since their URLs name the version.
// - Everything else, such as Firebase's own requests, is left alone.
// tests/sw.test.js checks that FILES lists every file index.html loads.
var CACHE = 'algebra-quest-v1';
var FIREBASE = 'https://www.gstatic.com/firebasejs/13.3.0/';
var FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon.ico',
  'css/styles.css',
  'js/checker.js',
  'js/mathexpr.js',
  'js/units.js',
  'js/plot.js',
  'js/calc.js',
  'js/game.js',
  'js/rewards.js',
  'js/mascot.js',
  'js/storage.js',
  'js/sound.js',
  'js/views.js',
  'js/ui.js',
  'js/online.js',
  'js/phone-units.js',
  'js/firebase-config.js',
  'js/cloud.js',
  'js/web-boot.js',
  'img/icon-180.png',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/axl/pink-happy.png',
  'img/axl/pink-cheer.png',
  'img/axl/pink-encourage.png',
  'img/axl/pink-think.png',
  'img/axl/purple-happy.png',
  'img/axl/purple-cheer.png',
  'img/axl/purple-encourage.png',
  'img/axl/purple-think.png',
  'img/axl/blue-happy.png',
  'img/axl/blue-cheer.png',
  'img/axl/blue-encourage.png',
  'img/axl/blue-think.png',
  FIREBASE + 'firebase-app-compat.js',
  FIREBASE + 'firebase-auth-compat.js',
  FIREBASE + 'firebase-firestore-compat.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(FILES); }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (names) {
    return Promise.all(names.filter(function (name) { return name !== CACHE; }).map(function (name) { return caches.delete(name); }));
  }).then(function () {
    return self.clients.claim();
  }));
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(fetch(request).then(function (response) {
      if (response.ok) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(request, { ignoreSearch: true }).then(function (cached) {
        return cached || (request.mode === 'navigate' ? caches.match('index.html') : Response.error());
      });
    }));
  } else if (request.url.indexOf(FIREBASE) === 0) {
    event.respondWith(caches.match(request).then(function (cached) {
      return cached || fetch(request);
    }));
  }
});
