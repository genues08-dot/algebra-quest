// Service worker for the online app: keeps the app's files so it opens offline.
// - The app's own files: from the network when it answers, else from the cache. The pet pictures in
//   img/pets are not kept ahead of time; each one is kept the first time it shows.
// - The Firebase scripts: from the cache first, since their URLs name the version.
// - Everything else, such as Firebase's own requests, is left alone.
// tests/sw.test.js checks that FILES lists every file index.html loads.
var CACHE = 'algebra-quest-v4';
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
  'js/pet-heads.js',
  'js/storage.js',
  'js/sound.js',
  'js/views.js',
  'js/ui.js',
  'js/online.js',
  'js/cloud-sync.js',
  'js/phone-units.js',
  'js/firebase-config.js',
  'js/cloud.js',
  'js/web-boot.js',
  'img/icon-180.png',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/icon-maskable-512.png',
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
  // 'reload' skips the browser's own cache, so the new set never holds a file from before the update.
  var fresh = FILES.map(function (file) { return new Request(file, { cache: 'reload' }); });
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(fresh); }).then(function () {
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

function fromCache(request) {
  return caches.match(request, { ignoreSearch: true }).then(function (cached) {
    return cached || (request.mode === 'navigate' ? caches.match('index.html') : undefined);
  });
}

// The network's answer, which also refreshes the cache. If it takes longer than NETWORK_WAIT_MS
// (a weak signal) and the cache has the file, the cached copy is used; the network's answer still
// refreshes the cache for next time. 'no-cache' asks the server whether the file changed, so the
// browser's own cache can't mix files from two versions after an update.
var NETWORK_WAIT_MS = 3000;
function networkFirst(request) {
  var network = fetch(request, { cache: 'no-cache' }).then(function (response) {
    if (response.ok) {
      var copy = response.clone();
      caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
    }
    return response;
  });
  return new Promise(function (resolve) {
    var answered = false;
    function answer(response) {
      if (answered) return;
      answered = true;
      resolve(response);
    }
    var timer = setTimeout(function () {
      fromCache(request).then(function (cached) { if (cached) answer(cached); });
    }, NETWORK_WAIT_MS);
    network.then(function (response) {
      clearTimeout(timer);
      answer(response);
    }, function () {
      clearTimeout(timer);
      fromCache(request).then(function (cached) { answer(cached || Response.error()); });
    });
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (request.url.indexOf(FIREBASE) === 0) {
    event.respondWith(caches.match(request).then(function (cached) {
      return cached || fetch(request);
    }));
  }
});
