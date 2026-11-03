// Service worker: uygulamanın dosyalarını telefona kaydeder, böylece internet yokken de açılır.
//
// Strateji "önce ağ, olmazsa önbellek": internet varsa her zaman en güncel dosya gelir (ve
// önbellek tazelenir); yoksa ya da ağ 3 saniyede yanıt vermezse kaydedilmiş kopya kullanılır.
// Böylece yeni sürüm yayınlanınca kullanıcı eski kodda takılı kalmaz.
//
// Yeni bir dosya eklersen FILES listesine de ekle (testler eksik dosyayı yakalar).
// Sürüm değişince CACHE adını da değiştir; eski önbellek kendiliğinden silinir.

const CACHE = 'butcedostum-0.4.0';
const NETWORK_TIMEOUT = 3000;

const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './js/app.js',
  './js/data/backup.js',
  './js/data/demo.js',
  './js/data/storage.js',
  './js/data/store.js',
  './js/domain/budget.js',
  './js/domain/categories.js',
  './js/domain/compare.js',
  './js/domain/dates.js',
  './js/domain/economy.js',
  './js/domain/money.js',
  './js/domain/text.js',
  './js/ui/charts.js',
  './js/ui/components.js',
  './js/ui/html.js',
  './js/ui/screens/add.js',
  './js/ui/screens/compare.js',
  './js/ui/screens/economy.js',
  './js/ui/screens/home.js',
  './js/ui/screens/payments.js',
  './js/ui/screens/reports.js',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' → tarayıcının HTTP önbelleğini atla, sunucudaki güncel dosyayı al
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith('butcedostum-') || k.startsWith('evdefteri-')) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function handle(request) {
  const cache = await caches.open(CACHE);
  // Uygulama tek sayfa (#/ ile geziniliyor): her sayfa açılışı index.html demek
  const key = request.mode === 'navigate' ? './index.html' : request;
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(key, response.clone());
    return response;
  });
  network.catch(() => {}); // önbellekten yanıt verildiyse ağ hatası sessizce geçsin
  try {
    return await Promise.race([
      network,
      new Promise((_, reject) => setTimeout(() => reject(new Error('zaman aşımı')), NETWORK_TIMEOUT)),
    ]);
  } catch {
    const cached = await cache.match(key, { ignoreSearch: true });
    if (cached) return cached;
    return network; // önbellekte de yoksa ağı beklemeye devam et
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(handle(request));
});
