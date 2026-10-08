/*
 * Service Worker von Kredit Pilot: macht die Webseite offline nutzbar.
 * Er legt nur die Dateien der Webseite ab (Seiten, Programmcode, Schriften, Symbole).
 * Eingaben aus den Rechnern werden hier weder gelesen noch gespeichert noch übertragen.
 * VERSION und FILES trägt der Build ein (siehe vite.config.ts).
 */
const VERSION = '__VERSION__';
const FILES = [/*__FILES__*/];
const CACHE = `kredit-pilot-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('kredit-pilot-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Antwort aus dem Netz, höchstens `ms` Millisekunden warten. */
function fromNetwork(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then((response) => {
      clearTimeout(timer);
      resolve(response);
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Nur eigene Dateien; die Besucherzählung und alles Fremde läuft unverändert übers Netz.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/_vercel/')) return;

  if (request.mode === 'navigate') {
    // Seiten: zuerst aktuell aus dem Netz, ohne Verbindung aus dem Speicher.
    event.respondWith(
      fromNetwork(request, 4000).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(url.pathname)) || (await cache.match('/')) || Response.error();
      }),
    );
    return;
  }

  // Programmteile, Schriften, Bilder: aus dem Speicher, sonst aus dem Netz.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok && url.pathname.startsWith('/assets/')) cache.put(request, response.clone());
      return response;
    }),
  );
});
