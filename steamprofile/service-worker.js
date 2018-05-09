self.addEventListener('install', function(e) {
	e.waitUntil(
		caches.open('diegocard').then(function(cache) {
			return cache.addAll([
				'/',
				'/steamprofile',
				'/index.html',
				'/steamprofile/index.html',
				'dist/app.min.js',
				'dist/app.min.css'
			]);
		})
	);
});

self.addEventListener('activate', function(event) {
	event.waitUntil(self.clients.claim());
});
  
self.addEventListener('fetch', function(event) {
	event.respondWith(
		caches.open('diegocard')
		.then(function(cache) {
			cache.match(event.request, {ignoreSearch: true})
		})
		.then(function(response) {
			return response || fetch(event.request);
		})
	);
});