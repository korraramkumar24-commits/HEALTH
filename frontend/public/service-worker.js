const CACHE_NAME = 'carehub-emergency-shell-v2';
const APP_SHELL = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch('/index.html').then(async (response) => {
      if (!response.ok) throw new Error('App shell could not be loaded.');
      const html = await response.clone().text();
      const assets = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)]
        .map((match) => match[1]);
      const cache = await caches.open(CACHE_NAME);
      await cache.put('/index.html', response);
      await cache.addAll([...APP_SHELL.filter((path) => path !== '/index.html'), ...assets]);
    })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('carehub-emergency-shell-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (
        await caches.match('/index.html', { ignoreVary: true })
        || new Response('Emergency contacts are unavailable offline. Reopen this app while online first.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      )),
    );
    return;
  }

  if (!['script', 'style', 'image', 'font', 'worker'].includes(request.destination)) {
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const responseCopy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy));
        }
        return response;
      });
    }),
  );
});
