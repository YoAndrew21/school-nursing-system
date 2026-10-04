/*
 * Service worker: permite usar la aplicación sin conexión.
 * Estrategia "red primero": con internet siempre se carga la última versión
 * publicada; sin internet (o con red muy lenta) se usa la copia guardada.
 * Al publicar cambios, subir VERSION para renovar la copia.
 */
const VERSION = '1.3.2';
const CACHE = `dae-${VERSION}`;
const NETWORK_TIMEOUT = 3500;

const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/i18n.js',
  './js/pdf.js',
  './js/estudiantes.js',
  './js/app.js',
  './vendor/jspdf.umd.min.js',
  './vendor/xlsx.full.min.js',
  './plantillas/Plantilla_Estudiantes.xlsx',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dae-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(networkFirst(event, req));
});

async function networkFirst(event, req) {
  const cache = await caches.open(CACHE);
  const fromNetwork = fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  });
  // La actualización de la copia continúa aunque se responda desde caché
  event.waitUntil(fromNetwork.catch(() => {}));

  const fallback = async () => {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') return cache.match('./index.html');
    return undefined;
  };

  const timeout = new Promise((resolve) => {
    setTimeout(async () => resolve(await fallback()), NETWORK_TIMEOUT);
  });

  try {
    const res = await Promise.race([fromNetwork, timeout.then((hit) => hit || fromNetwork)]);
    return res;
  } catch (e) {
    return (await fallback()) || Response.error();
  }
}
