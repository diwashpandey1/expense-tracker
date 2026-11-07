const CACHE_NAME = 'avora-shell-v2'
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => /^(pennywise|avora)-shell-/.test(key) && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  // API responses are user- or time-dependent. Keep them out of the offline shell cache.
  if (new URL(request.url).pathname.startsWith('/api/')) return
  if (request.mode === 'navigate') {
    const responsePromise = fetch(request)
    const cachePromise = responsePromise.then((response) => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone()
        return caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy))
      }
    }).catch(() => {})
    event.waitUntil(cachePromise)
    event.respondWith(responsePromise.catch(async () => (await caches.match(request)) || (await caches.match('/index.html'))))
    return
  }
  const resultPromise = caches.match(request).then((cached) => cached
    ? { response: cached, shouldCache: false }
    : fetch(request).then((response) => ({ response, shouldCache: true })))
  const cachePromise = resultPromise.then(({ response, shouldCache }) => {
    if (shouldCache && response.ok && response.type === 'basic') {
      const copy = response.clone()
      return caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
    }
  }).catch(() => {})
  event.waitUntil(cachePromise)
  event.respondWith(resultPromise.then(({ response }) => response))
})
