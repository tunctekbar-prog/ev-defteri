// Uygulamanın giriş noktası: store'u kurar, ekranlar arasında gezinmeyi (hash router) yönetir.
// Her ekran { title, mount(root, ctx, params) } biçiminde bir modüldür; veri değişince
// açık ekran yeniden çizilir.

import { createLocalStorageAdapter } from './data/storage.js';
import { createStore } from './data/store.js';
import { todayISO } from './domain/dates.js';
import { createSheet, createToaster } from './ui/components.js';
import addScreen from './ui/screens/add.js';
import homeScreen from './ui/screens/home.js';
import paymentsScreen from './ui/screens/payments.js';
import reportsScreen from './ui/screens/reports.js';

const SCREENS = {
  home: homeScreen,
  add: addScreen,
  payments: paymentsScreen,
  reports: reportsScreen,
};

const store = createStore(createLocalStorageAdapter());
const root = document.getElementById('screen');

const ctx = {
  store,
  today: () => todayISO(),
  navigate: (path) => {
    location.hash = `#/${path}`;
  },
  rerender: () => render(),
  toast: createToaster(document.getElementById('toast')),
  sheet: createSheet(document.getElementById('sheet')),
};

let current = { name: null, params: null };

function parseHash() {
  const [name, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  return { name: SCREENS[name] ? name : 'home', params: new URLSearchParams(query) };
}

function render({ resetScroll = false } = {}) {
  if (!current.name) return; // ilk yönlendirmeden önce
  const screen = SCREENS[current.name];
  document.title = `${screen.title} · Ev Defteri`;
  root.replaceChildren();
  screen.mount(root, ctx, current.params);
  if (resetScroll) window.scrollTo(0, 0);
  document.querySelectorAll('.nav__item').forEach((a) => {
    if (a.dataset.screen === current.name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function onRoute() {
  current = parseHash();
  render({ resetScroll: true });
  // Ekran değişince odağı başlığa taşı (ekran okuyucular yeni sayfayı duyursun)
  root.querySelector('h1')?.focus({ preventScroll: true });
}

// Sabit ödemeler (kira, aidat…) tarihi gelince kendiliğinden harcamalara işlenir. Veri her değiştiğinde
// (ör. yeni sabit ödeme eklenince), uygulama açılınca ve uygulamaya geri dönülünce kontrol edilir.
const syncFixed = () => store.syncFixedPayments(todayISO());

store.subscribe(() => {
  if (syncFixed()) return; // eşitleme yeni bir değişiklik yaptıysa ekranı o çizer
  render();
});
window.addEventListener('hashchange', () => {
  syncFixed();
  onRoute();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') syncFixed();
});
syncFixed();
onRoute();

// İnternetsiz çalışma: dosyalar service worker ile telefona kaydedilir (bkz. sw.js).
// Yalnızca güvenli adreslerde (https veya localhost) çalışır.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Çevrimdışı mod kurulamadı', err));
  });
  // Tarayıcıdan, yer darlığında verileri silmemesini iste (ana ekrana eklenince genelde kabul edilir)
  navigator.storage?.persist?.().catch(() => {});
}
