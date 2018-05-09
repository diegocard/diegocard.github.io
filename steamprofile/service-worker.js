var dataCacheName = 'dc-steamprofile';
var cacheName = 'dc-steamprofilea';
var filesToCache = [
	"/",
	"/index.html",
	"/dist/app.min.js",
	"/dist/app.min.css",
	"/images/globalheader_logo.png",
	"/images/footerLogo_valve.png",
	"/images/f65972a198c6d809f60e65a2cbfce2781d620dc6.jpg",
	"/images/f65972a198c6d809f60e65a2cbfce2781d620dc6_full.jpg",
	"/images/steamyears802_54.png",
	"/images/linkedin_icon.png",
	"/images/github_icon.png",
	"/images/speakerdeck_icon.png",
	"/images/steam_icon.png",
	"/images/oracle-logo.png",
	"/images/netsuite-logo.jpg",
	"/images/certifications/fing.png",
	"/images/certifications/michigan.png",
	"/images/certifications/stanford.png",
	"/images/certifications/google.png",
	"/images/certifications/frontend_masters.png",
	"/images/certifications/abstracta.png",
	"/images/responsibilities/respo_1.jpg",
	"/images/responsibilities/respo_2.jpg",
	"/images/responsibilities/respo_3.jpg",
	"/images/responsibilities/respo_4.jpg",
	"/images/responsibilities/respo_5.jpg",
	"/images/responsibilities/respo_6.jpg",
	"/images/responsibilities/respo_7.jpg",
	"/images/responsibilities/respo_8.jpg",
	"/images/responsibilities/respo_9.jpg",
	"/images/responsibilities/respo_10.jpg",
	"/images/responsibilities/respo_11.jpg",
	"/images/responsibilities/respo_12.jpg",
	"/images/responsibilities/respo_13.jpg",
	"/images/highlights/highlight_1.jpg",
	"/images/highlights/highlight_2.jpg",
	"/images/highlights/highlight_3.jpg",
	"/images/highlights/highlight_4.jpg",
	"/images/highlights/highlight_5.jpg",
	"/images/highlights/highlight_6.jpg",
	"/images/highlights/highlight_7.jpg",
	"/images/edgecast/btn_arrow_down_padded.png",
	"/images/edgecast/btn_header_installsteam_gray.png",
	"/images/edgecast/btn_header_installsteam_gray.png?v=1",
	"/images/edgecast/levels_arrows.png",
	"/images/edgecast/levels_geo_1-2.png",
	"/images/edgecast/levels_geo_1-2.png?v=2",
	"/images/edgecast/showcase_bg.png",
	"/service-worker.js"
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
