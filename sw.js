/* Liczydło APP – service worker (praca bez internetu i aktualizacje)
   Przy każdej nowej wersji zmienia się VERSION – telefon pobiera wtedy nowe pliki
   i pokazuje pasek „Dostępna nowa wersja”. */
const VERSION = '1.5.0';
const CACHE = 'liczydlo-app-' + VERSION;
const FONTS = 'liczydlo-fonts';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', event => {
  // Pliki nowej wersji pobierane z pominięciem pamięci podręcznej przeglądarki.
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, {cache:'reload'})))));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('liczydlo-app-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Nowa wersja czeka, aż użytkownik stuknie „Aktualizuj”.
self.addEventListener('message', event => {
  if(event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin === self.location.origin){
    if(url.pathname.endsWith('/version.json')){
      event.respondWith(fetch(req, {cache:'no-store'}).catch(() => new Response('{}', {headers:{'Content-Type':'application/json'}})));
      return;
    }
    // Stan licencji zawsze z serwera; bez internetu – błąd, a aplikacja zostaje przy ostatnim znanym stanie.
    if(url.pathname.endsWith('/kontrola.json')){
      event.respondWith(fetch(req, {cache:'no-store'}).catch(() => new Response('', {status:503, statusText:'offline'})));
      return;
    }
    // Strona operatora nie jest częścią aplikacji – zawsze z sieci.
    if(url.pathname.endsWith('/operator.html')) return;
    if(req.mode === 'navigate'){
      event.respondWith(caches.match('./index.html').then(r => r || fetch(req)));
      return;
    }
    event.respondWith(caches.match(req, {ignoreSearch:true}).then(r => r || fetch(req)));
    return;
  }
  if(url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'){
    event.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if(res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
