const CACHE_PREFIX = 'ww-combo-'
const CACHE_NAME = '__CACHE_NAME__'
const PRECACHE_URLS = __PRECACHE_URLS__
const APP_ROOT = new URL('./', self.location.href)
const INDEX_URL = new URL('index.html', APP_ROOT).href

const canCache = (response) =>
  response.ok && (response.type === 'basic' || response.type === 'default')

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (canCache(response)) {
            const cache = await caches.open(CACHE_NAME)
            await cache.put(INDEX_URL, response.clone())
          }
          return response
        })
        .catch(async () => (await caches.match(request)) ?? caches.match(INDEX_URL)),
    )
    return
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached

      return fetch(request).then(async (response) => {
        if (canCache(response)) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put(request, response.clone())
        }
        return response
      })
    }),
  )
})
