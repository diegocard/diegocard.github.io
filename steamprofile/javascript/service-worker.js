var dataCacheName = 'template-pwa';
var cacheName = 'template-pwa';
var filesToCache = [
	"../",
	"../index.html",
	"../fonts/motiva-sans-bold-italic.ttf",
	"../fonts/motiva-sans-light-italic.ttf",
	"../fonts/motiva-sans-regular-italic.ttf",
	"../fonts/MotivaSans-Black.ttf",
	"../fonts/MotivaSans-Bold.ttf",
	"../fonts/MotivaSans-Light.ttf",
	"../fonts/MotivaSans-Medium.ttf",
	"../fonts/MotivaSans-Regular.ttf",
	"../fonts/MotivaSans-Thin.ttf",
	"../images/icons/icon-128x128.png",
	"../images/icons/icon-144x144.png",
	"../images/icons/icon-152x152.png",
	"../images/icons/icon-192x192.png",
	"../images/icons/icon-256x256.png",
	"../index.html",
	"../manifest.json",
	"../dist/app.min.js",
	"../dist/app.min.css",
	"../service-worker.js"
];

self.addEventListener('install', function(e) {
	console.log('[ServiceWorker] Install');
	e.waitUntil(
		caches.open(cacheName).then(function(cache) {
			console.log('[ServiceWorker] Caching assets');
			return cache.addAll(filesToCache);
		})
	);
});

self.addEventListener('activate', function(e) {
	console.log('[ServiceWorker] Activate');
	e.waitUntil(
		caches.keys().then(function(keyList) {
			return Promise.all(keyList.map(function(key) {
				if (key !== cacheName && key !== dataCacheName) {
					console.log('[ServiceWorker] Removing old cache', key);
					return caches.delete(key);
				}
			}));
		})
	);
	return self.clients.claim();
});

self.addEventListener('fetch', function(e) {
	console.log('[Service Worker] Fetch', e.request.url);
	e.respondWith(
		caches.match(e.request).then(function(response) {
			return response || fetch(e.request);
		})
	);
});
