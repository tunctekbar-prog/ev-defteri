# Ev Defteri (web prototipi)

Aileler için sakin bir ev bütçe ve fatura defteri. Önce telefon ekranı için tasarlandı (mobile-first). Sunucu ve hesap yok; tüm veriler kullanıcının tarayıcısında (`localStorage`) kalıyor.

İleride geliştirmeye devam etmek için: **[GELISTIRME.md](GELISTIRME.md)** (mimari, veri modeli, verilen kararlar, sıradaki adımlar).

## Çalıştırma

Gereken tek şey [Node.js](https://nodejs.org) (18+). Paket kurulumu gerekmiyor.

**En kolayı (Windows):** klasördeki `Baslat.bat` dosyasına çift tıkla. Tarayıcı kendiliğinden açılır. Kapatmak için siyah pencereyi kapat.

Komutla (klasörün içinde bir terminal açıp):

```bash
npm start      # http://localhost:5173
npm test       # iş mantığı ve veri katmanı testleri
```

Sunucu açılınca aynı Wi-Fi'deki telefondan açılacak adresi de yazar (ör. `http://192.168.1.20:5173`).

> `index.html` dosyaya çift tıklanarak açılmaz: ES modülleri `file://` üzerinden çalışmıyor. Bu yüzden küçük bir sunucu gerekiyor.

## Ekranlar

| Ekran | Ne yapar |
|---|---|
| **Ana sayfa** | Bu ayın harcaması, bütçe ilerleme çubuğu, en yakın 3 ödeme, büyük "+ Harcama ekle" düğmesi. İlk açılışta karşılama ve "Örnek verilerle göz at". |
| **Ekle** | Tutarı yaz, kategoriye dokun, bitti. Harcama / Gelir geçişi. Not ve tarih isteğe bağlı. "Geri al" ile geri alınır. **Sabit harcama** (kira gibi) her ay seçilen günde kendiliğinden harcamalara eklenir ve yaklaşan ödemelerde "Sabit ödeme" etiketiyle görünür. Gelirde de **Sabit gelir** (maaş gibi) seçeneği var; Ödemeler ekranının "Sabit gelirler" bölümünde yönetilir. |
| **Ödemeler** | Fatura, kira, aidat, kredi kartı. Her ayın kaçında olduğu, durumu (Ödendi / 3 gün kaldı / Tarihi geçti). Değişken ödemeler "Ödedim" ile işaretlenir; **sabit ödemeler** tarihi gelince kendiliğinden eklenir, istenirse o ay atlanır. Simgeler ada göre seçilir (İnternet 📶, Doğalgaz 🔥, Su 💧…). |
| **Raporlar** | İki sekme. **Aylık özet:** ay ay gelen/giden/artan, bütçe kullanımı, kategori dağılımı, geçen aya göre nazik notlar, kayıt listesi (silme + geri al), tüm verileri silme. **Aylar arası:** seçilen ayların gelen/giden çizgi grafiği ve tablosu (varsayılan: geçen ay + bu ay), kategori tablosu, isteğe bağlı detaylı kalem karşılaştırması (Akbil, Pazar, Eczane…; ilk açılışta en çok harcanan 3 kalem, istenen kadar kalem eklenebilir). **Ev ekonomisi:** günlük harcanabilir limit, ay sonu tahmini, gelirin ne kadarının cepte kaldığı, 50/30/20 dağılımı, düzenli ödemelerin yıllık maliyeti. |

## Klasör yapısı

```
index.html, css/styles.css   Uygulama kabuğu ve stil
js/
  app.js                     Giriş noktası: store'u kurar, ekranlar arası gezinme (hash router)
  domain/                    Saf iş mantığı: DOM veya depolama bilmez, Node'da test edilir
    money.js                 Kuruş cinsinden tutar, Türkçe tutar okuma/yazma
    dates.js                 Ay/gün hesapları, Türkçe ay adları
    categories.js            Harcama/gelir kategorileri, ödeme türleri
    budget.js                Aylık özet, ödeme durumu, yaklaşan ödemeler, nazik mesajlar
    compare.js               Aylar arası toplamlar, kategori ve kalem karşılaştırması
    economy.js               Günlük limit, ay sonu tahmini, tasarruf oranı, 50/30/20, yıllık maliyet
    text.js                  Türkçe ekler (%60'ı, %50'si…)
  data/
    storage.js               Depolama adaptörü: { load, save }
    store.js                 Verinin tek kaynağı; tüm değişiklikler buradan geçer
    demo.js                  Örnek veri
  ui/
    html.js                  Güvenli HTML şablonu (kullanıcı metnini kaçışlar)
    components.js            Ortak parçalar: ilerleme çubuğu, ödeme satırı, toast, alt sayfa
    charts.js                Bağımlılıksız SVG çizgi grafik (ipucu kutusu, klavye desteği)
    screens/                 Dört ekran: home, add, payments, reports
sw.js                        Service worker: internetsiz çalışma
scripts/make-icons.js        icon.svg'deki çizimden PNG ikonlar üretir (npm run icons)
tests/                       node:test ile birim testler
```

## Telefona taşırken

Yapı, arayüzü baştan yazmadan telefona geçmeye göre kuruldu:

- **PWA:** Manifest, ikonlar ve service worker (`sw.js`) hazır; uygulama bir kez açıldıktan sonra internetsiz de çalışır. Eksik tek şey HTTPS üzerinde yayın (GitHub Pages / Netlify); yayınlanınca "Ana ekrana ekle" ile uygulama gibi kurulur. (Service worker yalnızca `localhost` ve `https` adreslerde çalışır; telefondan yerel ağ adresiyle açınca çevrimdışı mod devreye girmez.)
- **Depolama değişimi:** `localStorage` yerine IndexedDB veya mobil uygulamada SQLite kullanmak için sadece `js/data/storage.js` içinde yeni bir adaptör yazılır; ekranlar etkilenmez.
- **Gerçek mobil uygulama:** `js/domain/` ve `js/data/store.js` hiçbir tarayıcı API'sine bağlı değil; React Native veya Capacitor'a aynen taşınabilir. Capacitor seçilirse mevcut arayüz de olduğu gibi kullanılır.
- **Sunucu/hesap gelirse:** Store'un arayüzü (`addTransaction`, `markPaymentPaid`…) korunup arkasına senkronizasyon eklenir. KVKK ve şifreleme bu noktada baştan ele alınmalı.

## Bilinçli olarak yok (1. sürüm)

Banka bağlantısı, hesap/giriş, aile ortak bütçesi, fiş okuma, sesli giriş, bildirimler.
