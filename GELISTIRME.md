# Bütçe Dostum: Geliştirme Notları

> Uygulamanın eski adı **Ev Defteri** idi (0.4.0'da değişti). Depo ve adres eski adla kaldı: `ev-defteri`.

Bu dosya, projeye ara verip geri döndüğünde (ya da başka bir geliştiriciye / Claude Code'a devrederken) nereden devam edeceğini bilmek için. Çalıştırma talimatları ve klasör yapısı [README.md](README.md) içinde.

**Sürüm:** 0.5.0 (3 Kasım 2026)
**Durum:** Web uygulaması (PWA) yayında, gerçek kullanıcıyla denenmeye hazır. İnternetsiz çalışıyor, telefona "Ana ekrana ekle" ile kurulabiliyor.

---

## 0. Hızlı başlangıç (yeni sohbet için önce bunu oku)

| | |
|---|---|
| **Canlı adres** | https://tunctekbar-prog.github.io/ev-defteri/ |
| **GitHub deposu** | https://github.com/tunctekbar-prog/ev-defteri (public, dal: `main`, GitHub Pages: `main` / root) |
| **Yerel klasör** | `C:\Users\Administrator\Downloads\Difficulty Mods 42 1 2026-09-04T18-57Z upSzVa0vu\ev-defteri-v0.2.0\ev-defteri` |
| **Ad** | **Bütçe Dostum** (eski adı Ev Defteri). Depo/adres bilerek `ev-defteri` kaldı; kullanıcı linkin değişmesini istemedi |
| **Yayınlama** | `git add -A && git commit -m "…" && git push` → 1-2 dk sonra canlıda. Bu bilgisayarda git girişi kayıtlı; `gh` CLI yok. Sürüm çıkarırken `sw.js` → `CACHE` ve `package.json` → `version` değişir |
| **Test** | `npm test` → 21 test, hepsi geçiyor |
| **Sıradaki iş** | **Kayıt düzenleme** (bkz. 6A). Kullanıcıya önerildi, henüz başlanmadı |

**Çalışma şekli (kullanıcının tercihleri):**
- Kullanıcı Türkçe yazıyor, teknik olmayan, kısa ve net açıklama istiyor. Ne yapıldığını ve *neden* yapıldığını sade dille anlat.
- Her değişiklikten sonra: testleri çalıştır, arayüzü telefon boyutunda (390 px) kontrol et, GitHub'a gönder, canlı sitenin güncellendiğini doğrula, sonra "yayında" diye haber ver.
- Simge/tasarım gibi zevk kararlarında seçenek sun; kullanıcı görsel referans gönderebiliyor.
- Arayüzü doğrulamak için: headless **Edge** + Chrome DevTools Protocol (Node'un yerleşik `WebSocket`'i ile) iyi çalışıyor. Bu ortamda headless Chrome'da Cache Storage "internal error" veriyor; Edge'de sorun yok. Telefon boyutu için `Emulation.setDeviceMetricsOverride` (390 px) kullan; pencere boyutu 492 px'in altına inmiyor.

**Son oturum (3 Kasım 2026) özeti:** yedekle/geri yükle → internetsiz çalışma (PWA) → aylar arası tabloda "—" kuralı ve telefona sığan tablolar → GitHub Pages yayını → ad değişikliği (Bütçe Dostum) → kullanıcının referans görseline göre yeni amblem ve amblemden renk teması.

---

## 1. Şu an ne var?

| Ekran | Özellikler |
|---|---|
| **Ana sayfa** | Bu ayın harcaması, bütçe çubuğu ("%31'i kullanıldı"), en yakın 3 ödeme, yapışık "+ Harcama ekle" düğmesi. İlk açılışta karşılama kartı (kumbara simgesi, 3 kısa madde, bütçe sorusu, örnek veri); bu sırada yapışık düğme gizli |
| **Ekle** | Tutar → kategoriye dokun → bitti. Harcama/Gelir. Not, tarih isteğe bağlı. **Sabit harcama** ve **sabit gelir** (her ay kendiliğinden eklenir). "Geri al" |
| **Ödemeler** | Düzenli ödemeler, tarih sırasıyla. Değişkenler "Ödedim" ile, sabitler kendiliğinden işlenir ("Bu ay atla" / "Yine de ekle"). Ada göre simge (📶 İnternet, 🔥 Doğalgaz…). Altta "Sabit gelirler" bölümü |
| **Raporlar → Aylık özet** | Gelen/giden/artan, bütçe, kategori dağılımı, geçen aya göre nazik notlar, kayıt listesi (sil + geri al). **Verilerim:** yedeği indir (JSON), yedekten yükle (onay + geri al), son yedek tarihi (30 günü geçince bölüm açık gelir ve nazikçe hatırlatır), tüm verileri sil |
| **Raporlar → Aylar arası** | Ay seçimi (varsayılan geçen ay + bu ay), gelen/giden çizgi grafiği + tablo, kategori tablosu, detaylı kalem karşılaştırması (ilk 3 kalem, sınırsız eklenebilir). Değişim okları: harcamada azalış yeşil ↓, artış kırmızı ↑; gelirde tersi. Bir ayda tutar yoksa değişim "—", aynıysa "Aynı". 2 aylık tablolar telefona yana kaydırmadan sığar |
| **Raporlar → Ev ekonomisi** | Günlük harcanabilir limit, ay sonu tahmini, gelirin ne kadarı cepte kaldı, 50/30/20 dağılımı, düzenli ödemelerin yıllık maliyeti |

**Testler:** `npm test` ile 21 test (iş mantığı, veri katmanı, yedek, ad değişikliği taşıması, çevrimdışı dosya listesi). Hepsi geçiyor.

**Görünüm:** Amblem `icons/icon.svg` (mürekkep çizgili kum rengi kumbara, filizli pencere, ₺'li bakır para, uzun yeşil gölge). Tema renkleri amblemden (`css/styles.css` → `:root`): kağıt dokulu zemin, krem kartlar, mürekkep yazı, adaçayı yeşili düğmeler (mürekkep çerçeve + yeşil gölge), bakır vurgular.

---

## 2. Mimari: üç katman

```
js/domain/   Saf hesap. Tarayıcı, DOM, localStorage bilmez. Node'da test edilir.
js/data/     Verinin tek kaynağı (store) + depolama adaptörü + yedek dosyası (backup.js).
js/ui/       Ekranlar ve bileşenler. Veriyi sadece store fonksiyonlarıyla değiştirir.
sw.js        Service worker: dosyaları önbelleğe alır, internetsiz açılmayı sağlar.
```

**Kurallar (bunları koru):**
1. **Hesaplama `domain/` içinde olur**, ekranda değil. Yeni bir rapor = önce `domain/`'e saf fonksiyon + test, sonra ekran.
2. **Veri sadece `store.js` üzerinden değişir.** Ekran `store.addTransaction(...)` çağırır, `state`'i doğrudan değiştirmez.
3. **Para her yerde kuruş cinsinden tam sayı.** `45000` = ₺450. Gösterirken `formatMoney()`, okurken `parseAmount()`.
4. **Tarihler metin:** `'2026-11-02'`, aylar `'2026-11'`. `toISOString()` kullanma (saat dilimi kaydırır), `dates.js` yardımcılarını kullan.
5. **Kullanıcı metni her zaman kaçışlanır:** HTML'i `html\`...\`` şablonuyla üret (`ui/html.js`). `innerHTML = '...' + not` gibi birleştirme yapma.
6. **Yeni dosya eklersen `sw.js` → `FILES` listesine de ekle.** Unutursan `npm test` hangi dosyanın eksik olduğunu söyler. Sürüm çıkarırken `CACHE` adını değiştir.
7. **Bağımlılık yok.** Derleme adımı, npm paketi yok. Eklemeden önce iki kere düşün; eklersen PWA/mobil taşımayı zorlaştırmamalı.

**Ekran yapısı:** Her ekran `{ title, mount(root, ctx, params) }`. Veri değişince açık ekran baştan çizilir (`app.js` → `render()`). Ekran içi geçici seçimler (ör. karşılaştırmada seçili aylar) modül düzeyinde bir nesnede tutulur (`screens/compare.js` → `view`).

**`ctx` içinde:** `store`, `today()`, `navigate(path)`, `rerender()`, `toast(mesaj, { actionLabel, onAction })`, `sheet.open({ title, body, onMount })`.

---

## 3. Veri modeli (localStorage anahtarı: `butcedostum`, sürüm 1)

```js
{
  version: 1,
  transactions: [{ id, type: 'expense'|'income', amount /*kuruş*/, categoryId, note, date: 'YYYY-MM-DD', createdAt }],
  payments: [{
    id, name, kind: 'fatura'|'kira'|'aidat'|'kredi_karti'|'diger',
    amount /*0 = değişken*/, dayOfMonth /*1-31*/, active,
    fixed /*true = her ay kendiliğinden eklenir*/, startMonth: 'YYYY-MM',
    categoryId /*isteğe bağlı*/, direction /*'income' = sabit gelir*/,
    paidMonths: { 'YYYY-MM': { amount, date, transactionId|null, auto?, skipped? } }
  }],
  settings: { monthlyBudget /*kuruş*/, onboarded, lastBackupAt /*'YYYY-MM-DD', isteğe bağlı*/ }
}
```

- **Sabit ödeme/gelir nasıl çalışır:** `store.syncFixedPayments(bugün)` başlangıç ayından bu aya kadar, tarihi gelmiş ve `paidMonths`'ta olmayan her ay için kayıt oluşturur. Uygulama açılınca, ekran değişince, uygulamaya geri dönülünce ve her veri değişikliğinden sonra çağrılır. Tekrar çağırmak güvenlidir.
- **"Bu ay atla":** `paidMonths[ay] = { skipped: true }`. Böylece eşitleme o ayı yeniden eklemez. Sabit ödemeye bağlı bir kayıt Raporlar'dan silinirse de aynısı olur.
- **Eski ad:** `storage.js` ilk açılışta `evdefteri` anahtarındaki veriyi okur, ilk kayıtta `butcedostum`'a yazıp eskisini siler. `backup.js` `app: 'evdefteri'` yedeklerini de kabul eder. Service worker eski `evdefteri-*` önbelleklerini siler.
- **Şema değişirse:** `store.js` → `SCHEMA_VERSION`'ı artır ve `migrate()` içine eski veriyi yeni şekle çeviren kodu yaz. Kullanıcıların telefonundaki eski veri bozulmamalı.

---

## 4. Verilen kararlar (neden böyle?)

| Karar | Neden |
|---|---|
| Kaydedince ana sayfaya dönülür | Güncel özeti hemen görsün. Art arda çok giriş isteyen olursa Ekle'de kalmak seçeneği düşünülebilir |
| "Kira" kategorisi = "Kira, aidat" | Aidat ödemeleri de buraya yazılıyor |
| Kredi kartı ödemesi varsayılan olarak harcamaya eklenmez, günlük limitte ayrılmaz, yıllık maliyete girmez | Kart harcamaları zaten tek tek giriliyorsa iki kere sayılır |
| Değişim sütunu yalnızca ilk ve son ayın ikisinde de tutar varsa hesaplanır; yoksa "—". Tutar aynıysa "Aynı" | Bir ayda hiç yoksa fark, kalemin tutarının kendisi olurdu; karşılaştırma anlamı taşımaz (`domain/compare.js` → `changeBetween`) |
| Tema renkleri amblemden: kağıt zemin, mürekkep (`--ink`), adaçayı yeşili, bakır; ana düğmeler mürekkep çerçeve + yeşil "uzun gölge" | Uygulama ile amblem tek bir kimlik gibi görünsün. Yazı/zemin çiftleri ≥ 4.5:1 kontrast. Renkler `css/styles.css` → `:root`'ta, amblem `scripts/make-icons.js`'te |
| Grafik renkleri mavi/turuncu/aqua… (uygulamanın yeşili değil) | Renk körlüğü testinden geçen sıra. Yeşil-turuncu çifti geçmedi |
| 8'den fazla kalemde renkler kesikli, sonra noktalı çizgiyle tekrar eder | Her kalem ayırt edilsin; tam rakamlar her zaman tabloda |
| 50/30/20'de "Diğer" isteğe bağlı sayılır | Tartışılabilir; `domain/economy.js` → `NEEDS` |
| Tasarruf oranı ve 50/30/20 son **tamamlanmış** aydan | İçinde bulunulan ay bitmediği için oran yanıltıcı olurdu |
| Ay sonu tahmini ayın ilk haftasında geçen ayın temposunu kullanır | Veri az olunca tahmin uçar |
| Günlük limit aşağı, tahminler tam liraya yuvarlanır | Limit asla olduğundan fazla görünmesin; kuruş hassasiyeti gereksiz |
| Sabit gelirler yaklaşan ödemelerde görünmez | Ana sayfa "ödenecekler" listesi; maaş orada kafa karıştırır |
| Dil: yargılamayan, sıcak | Brief'in tasarım ilkesi. "Bütçeyi aştın!" yerine "Bir göz atalım mı?" |

---

## 5. Bilinen eksikler ve riskler

1. **Yedek elle alınıyor.** Veriler sadece o tarayıcıda; kullanıcı yedek almazsa telefon değişince her şey gider. Raporlar → Verilerim 30 günde bir hatırlatıyor ama ana sayfada uyarı yok. iOS Safari'de indirilen dosya "Dosyalar"a gider, kullanıcıya gösterilmesi gerekebilir.
2. **Çevrimdışı mod yalnızca canlı adreste (https) ve `localhost`'ta çalışır.** Telefondan `http://192.168.x.x:5173` ile açınca çevrimdışı mod ve ana ekrana ekleme çalışmaz; telefonda denemek için canlı adresi kullan.
   - Önbellek stratejisi "önce ağ": internet varsa her zaman güncel dosya gelir, ağ 3 sn'de yanıt vermezse önbellek. Yani yeni sürüm kullanıcıya kendiliğinden ulaşır; "güncelleme var" düğmesi gerekmedi.
   - `navigator.storage.persist()` isteniyor: tarayıcı yer darlığında verileri silmesin diye (ana ekrana ekli uygulamalarda genelde kabul edilir). Yine de yedek önemli.
3. **Ödemeyi geçmiş tarihli eklemek:** Ödemeler ekranından eklenen sabit ödeme bu aydan başlar; geçmiş aylar için kayıt oluşturmaz (bilinçli).
4. **Sabit ödemenin tutarı değişirse** sadece sonraki aylar etkilenir; geçmiş kayıtlar aynen kalır (bilinçli).
5. **Karanlık mod yok.** Grafik renkleri açık tema için doğrulandı.
6. **Çok kayıt olunca** (binlerce) her ekran tüm listeyi tarar. Şimdilik sorun değil; IndexedDB'ye geçerken gözden geçirilmeli.
7. **Gün değişimi:** Uygulama gece yarısı açık kalırsa sabit ödemeler bir sonraki etkileşimde işlenir (ekran değişimi / uygulamaya dönüş).

---

## 6. Sıradaki adımlar (önerilen sıra)

### A. Gerçek kullanıcı öncesi (kısa iş)
- [x] **Yedekle / Geri yükle** (0.2.1). Dosya biçimi: `{ app: 'butcedostum', backupVersion, exportedAt, data }`. Yüklerken `parseBackup()` doğrular, `store.importData()` `migrate()`'ten geçirir.
- [x] **Çevrimdışı çalışma** (0.3.0): `sw.js`, PNG ikonlar (`npm run icons` ile `scripts/make-icons.js` üretir), manifest ve iPhone meta etiketleri.
- [x] **HTTPS'te yayın:** GitHub Pages. Depo: https://github.com/tunctekbar-prog/ev-defteri, adres: https://tunctekbar-prog.github.io/ev-defteri/
- [x] **Ad + amblem + tema** (0.4.0-0.5.0): Bütçe Dostum, kumbara amblemi, amblemden renkler.
- [ ] **Kayıt düzenleme (SIRADAKİ):** Şu an kayıt sadece silinebiliyor; tutar/kategori/not/tarih düzeltme yok. Öneri: Raporlar'daki kayıt listesinde satıra dokununca alttan açılan sayfa (`ctx.sheet`); `store.updateTransaction(id, patch)` + test. Sabit ödemeye bağlı kayıt düzenlenirse `paidMonths[ay].amount` de güncellenmeli.
- [ ] Telefonda "Ana ekrana ekle" ve uçak modunda açılış denenmeli (Android Chrome + iPhone Safari). Kullanıcı henüz geri bildirim vermedi. Eski simgeyle eklenmişse kaldırıp yeniden eklemek gerekebilir.
- [ ] Alan adı: Kullanıcı sordu; şimdilik github.io adresi yeterli. Alınırsa **ailelere vermeden önce** bağlanmalı (adres değişirse tarayıcıdaki kayıtlar yeni adreste görünmez).
- [ ] 3-5 aileyle deneme; nerede takıldıklarını not et.

### B. Brief'teki yol haritası (her kat bir öncekinden sonra)
| Kat | İçerik | Notlar |
|---|---|---|
| 2. Akıllı | Yazıyla/sesle giriş ("markete 450 lira verdim"), otomatik kategori, geçen aya göre uyarı, unutulan abonelik tespiti | Metinden tutar+kategori çıkarma `domain/`'e saf fonksiyon olarak yazılabilir. Abonelik tespiti: aynı notla 3+ ay benzer tutar → "Bunu sabit ödeme yapalım mı?" |
| 3. Aile | Ortak bütçe, aile üyeleri, çocuk harçlığı/kumbara | Sunucu + hesap gerektirir → KVKK, şifreleme baştan düşünülmeli |
| 4. Hedef | Tasarruf hedefleri, taksit/borç takvimi, yumuşak uyarılar | Taksit = bitiş tarihi olan sabit ödeme (`endMonth` alanı) |
| 5. Toplumsal | Hak hatırlatma (doğalgaz desteği, sosyal yardım, burs tarihleri), mahalle fiyatları, anonim kıyaslama | **Fark yaratıcı fikir: hak hatırlatma.** İlk sürüm sunucusuz olabilir: tarih listesi uygulamayla birlikte gelir |
| 6. Ev yönetimi | Garanti belgeleri, DASK/sigorta/araç muayene yenileme tarihleri | Yıllık tekrarlayan ödeme (`dayOfMonth` + `month`) |

### C. Ev ekonomisi sayfasına eklenebilecekler
- Abonelikleri ayrı gösterme (Netflix, spor salonu…) ve "en son ne zaman kullandın?" sorusu
- Faturaların mevsimsel karşılaştırması (bu kış / geçen kış doğalgaz)
- "Bu tempoyla yıl sonunda ne kadar birikir?"

---

## 7. Mobil uygulamaya taşıma

- **Depolama:** `js/data/storage.js`'e yeni bir adaptör yaz (`{ load, save }`): IndexedDB, Capacitor Preferences veya SQLite. Başka hiçbir dosya değişmez.
- **Capacitor (önerilen):** Mevcut HTML/CSS/JS olduğu gibi Android/iOS uygulamasına sarılır. Bildirimler (`@capacitor/local-notifications`) ile "Kira 3 gün sonra" hatırlatmaları eklenebilir.
- **React Native'e geçilirse:** `js/domain/` ve `js/data/store.js` aynen taşınır; sadece ekranlar yeniden yazılır.

---

## 8. Geliştirirken

Windows'ta en kolayı: `Baslat.bat` dosyasına çift tıkla. Ya da terminalde:

```bash
npm start     # http://localhost:5173 (telefondan: aynı Wi-Fi'de ekrandaki adres)
npm test      # birim testleri
```

- Yeni hesaplama → `tests/domain.test.js`'e test ekle.
- Arayüz değişikliğinden sonra telefon boyutunda (390 px genişlik) kontrol et: tarayıcıda F12 → cihaz görünümü.
- Erişilebilirlik kuralları: dokunma alanı en az 44-48 px, renk tek başına anlam taşımaz (yanında ikon/yazı), yazı en az 16 px.
- Grafik eklerken: tek eksen, ince çizgi (2 px), lejant + altında tablo, renkleri `ui/charts.js` → `seriesStyle()`'dan al.

### Yayınlama
Derleme adımı yok: `git add -A`, `git commit -m "…"`, `git push` → GitHub Pages bir iki dakika içinde siteyi günceller. Sürüm çıkarırken `sw.js` → `CACHE` adını ve `package.json` sürümünü değiştir. Telefondaki uygulama yeni sürümü bir sonraki açılışta internetten alır.

### Claude Code ile devam ederken
Yeni bir oturumda şöyle başlayabilirsin:

> "ev-defteri klasöründeki Bütçe Dostum projesine devam ediyoruz. Önce GELISTIRME.md'yi (özellikle 0. bölümü) oku. Sonra şunu yapalım: …"

Bu dosyayı da güncel tut: her büyük değişiklikten sonra "Şu an ne var?" ve "Sıradaki adımlar" bölümlerini güncelle.

---

## 9. Sürüm geçmişi

| Sürüm | İçerik |
|---|---|
| 0.1.0 | 4 ekran: Ana sayfa, Ekle, Ödemeler, Raporlar. Yerel veri, örnek veri |
| 0.2.0 | Aylar arası karşılaştırma (grafik + tablolar + detaylı kalem), sabit harcama/gelir, ada göre ödeme simgeleri, Ev ekonomisi sayfası, renkli değişim okları |
| 0.2.1 | Yedeği indir / yedekten yükle (doğrulama, onay, geri al), son yedek tarihi ve 30 günlük hatırlatma |
| 0.3.0 | İnternetsiz çalışma: service worker (önce ağ, 3 sn sonra önbellek), PNG ikonlar (192/512/maskable/iPhone), manifest ve iPhone meta etiketleri, kalıcı depolama isteği |
| 0.3.1 | Aylar arası: bir ayda tutarı olmayan kalemde değişim "—", aynı tutarda "Aynı". Git deposu, GitHub Pages hazırlığı |
| 0.4.0 | Yeni ad: **Bütçe Dostum**. Kumbara simgesi (`scripts/make-icons.js` svg + PNG'leri tek tanımdan üretir), yenilenen karşılama kartı, eski adla kayıtlı veri ve yedeklerin taşınması, tablolar telefona sığıyor |
| 0.5.0 | Yeni amblem (mürekkep çizgili kum rengi kumbara, filizli pencere, ₺'li bakır para, uzun yeşil gölge) ve amblemden alınan renk teması: kağıt dokulu zemin, krem kartlar, adaçayı yeşili düğmeler |
