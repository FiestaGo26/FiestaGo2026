// FiestaGo Service Worker
// Estrategia: network-first para HTML/API (siempre frescos),
// cache-first para assets estáticos (rápido). Sin precaching de
// páginas — Next.js ya hace su propio chunk splitting eficiente.

const VERSION    = 'fg-v1';
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

// Assets que SIEMPRE queremos en cache (instalados al primer arranque).
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(VERSION))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo GET
  if (request.method !== 'GET') return;

  // Mismo origen
  if (url.origin !== location.origin) return;

  // Endpoints API → network-first sin caché (queremos datos frescos)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(
        JSON.stringify({ error: 'offline' }),
        { headers: { 'Content-Type': 'application/json' }, status: 503 }
      ))
    );
    return;
  }

  // HTML páginas → network-first con fallback a caché
  const isHtml = request.headers.get('accept')?.includes('text/html');
  if (isHtml) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => null);
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Assets estáticos (JS, CSS, fonts, imágenes) → cache-first
  if (/\.(js|css|woff2?|ttf|eot|png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname) ||
      url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)).catch(() => null);
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }
});

// Push notifications — preparado para cuando configures VAPID.
// Por ahora solo el listener vacío para que el navegador sepa que
// soportamos push (mejora puntuación PWA).
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); }
  catch { data = { title: 'FiestaGo', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(data.title || 'FiestaGo', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
