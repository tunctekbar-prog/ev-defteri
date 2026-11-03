import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createMemoryAdapter } from '../js/data/storage.js';
import { createStore } from '../js/data/store.js';
import { gentleInsights, monthSummary, paymentStatus, statusText, upcomingPayments } from '../js/domain/budget.js';
import { addMonths, daysBetween, dueDateIn, monthLocative } from '../js/domain/dates.js';
import { amountToInput, formatMoney, parseAmount } from '../js/domain/money.js';
import { percentWithSuffix } from '../js/domain/text.js';
import { html } from '../js/ui/html.js';

test('parseAmount Türkçe yazımı anlar', () => {
  assert.equal(parseAmount('450'), 45000);
  assert.equal(parseAmount('450,5'), 45050);
  assert.equal(parseAmount('1.250,75'), 125075);
  assert.equal(parseAmount('1.250'), 125000);
  assert.equal(parseAmount('12.5'), 1250);
  assert.equal(parseAmount('₺ 30.000'), 3000000);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount(''), null);
});

test('formatMoney ve amountToInput', () => {
  assert.match(formatMoney(45000), /^₺450$/);
  assert.match(formatMoney(125075), /^₺1\.250,75$/);
  assert.equal(amountToInput(45050), '450,50');
  assert.equal(amountToInput(0), '');
});

test('tarih yardımcıları', () => {
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(dueDateIn('2026-02', 31), '2026-02-28');
  assert.equal(daysBetween('2026-03-28', '2026-04-02'), 5);
  assert.equal(monthLocative('2026-11'), "Kasım'da");
  assert.equal(monthLocative('2026-10'), "Ekim'de");
  assert.equal(monthLocative('2026-03'), "Mart'ta");
  assert.equal(monthLocative('2026-02'), "Şubat'ta");
  assert.equal(monthLocative('2026-09'), "Eylül'de");
});

test('yüzde ekleri', () => {
  assert.equal(percentWithSuffix(60), "%60'ı");
  assert.equal(percentWithSuffix(50), "%50'si");
  assert.equal(percentWithSuffix(100), "%100'ü");
  assert.equal(percentWithSuffix(75), "%75'i");
  assert.equal(percentWithSuffix(3), "%3'ü");
  assert.equal(percentWithSuffix(9), "%9'u");
  assert.equal(percentWithSuffix(40), "%40'ı");
  assert.equal(percentWithSuffix(6), "%6'sı");
});

test('ödeme durumu ve yaklaşan ödemeler', () => {
  const rent = { id: 'a', name: 'Kira', kind: 'kira', amount: 1500000, dayOfMonth: 5, paidMonths: {} };
  const net = { id: 'b', name: 'İnternet', kind: 'fatura', amount: 45000, dayOfMonth: 1, paidMonths: { '2026-11': { amount: 45000 } } };
  const gas = { id: 'c', name: 'Doğalgaz', kind: 'fatura', amount: 0, dayOfMonth: 1, paidMonths: {} };

  assert.equal(paymentStatus(rent, '2026-11', '2026-11-02').state, 'soon');
  assert.equal(statusText(paymentStatus(rent, '2026-11', '2026-11-02')), '3 gün kaldı');
  assert.equal(paymentStatus(gas, '2026-11', '2026-11-02').state, 'overdue');
  assert.equal(statusText(paymentStatus(gas, '2026-11', '2026-11-02')), 'Tarihi 1 gün geçti');

  const list = upcomingPayments([rent, net, gas], '2026-11-02');
  assert.deepEqual(
    list.map((s) => [s.payment.name, s.dueDate]),
    [
      ['Doğalgaz', '2026-11-01'],
      ['Kira', '2026-11-05'],
      ['İnternet', '2026-12-01'], // bu ayki ödendi, sıradaki ay görünür
    ],
  );
});

test('store: ekle, özetle, ödendi işaretle, sil ve geri al', () => {
  const store = createStore(createMemoryAdapter());
  store.setMonthlyBudget(1000000);
  store.addTransaction({ type: 'expense', amount: 45000, categoryId: 'market', date: '2026-11-02' });
  store.addTransaction({ type: 'income', amount: 4200000, categoryId: 'maas', date: '2026-11-01' });
  const p = store.addPayment({ name: 'Kira', kind: 'kira', amount: 500000, dayOfMonth: 5 });

  store.markPaymentPaid(p.id, '2026-11', { amount: 500000, date: '2026-11-02', addAsExpense: true });
  let s = monthSummary(store.getState(), '2026-11');
  assert.equal(s.expense, 545000);
  assert.equal(s.income, 4200000);
  assert.equal(s.usedRatio, 0.545);
  assert.equal(s.byCategory[0].category.id, 'kira');

  // Ödemeye bağlı harcamayı silmek ödemeyi "ödenmedi"ye çevirir; geri al hepsini geri getirir.
  const linkedTx = store.getState().transactions.find((t) => t.categoryId === 'kira');
  const removed = store.deleteTransaction(linkedTx.id);
  assert.equal(store.getState().payments[0].paidMonths['2026-11'], undefined);
  store.restoreTransaction(removed);
  assert.ok(store.getState().payments[0].paidMonths['2026-11']);
  assert.equal(monthSummary(store.getState(), '2026-11').expense, 545000);

  store.unmarkPaymentPaid(p.id, '2026-11');
  s = monthSummary(store.getState(), '2026-11');
  assert.equal(s.expense, 45000);
});

test('kredi kartı ödemesi istenmezse harcamaya eklenmez', () => {
  const store = createStore(createMemoryAdapter());
  const p = store.addPayment({ name: 'Kart', kind: 'kredi_karti', amount: 0, dayOfMonth: 20 });
  store.markPaymentPaid(p.id, '2026-11', { amount: 800000, date: '2026-11-20', addAsExpense: false });
  assert.equal(store.getState().transactions.length, 0);
  assert.equal(store.getState().payments[0].paidMonths['2026-11'].transactionId, null);
});

test('nazik uyarı yalnızca belirgin artışta çıkar', () => {
  const store = createStore(createMemoryAdapter());
  store.addTransaction({ type: 'expense', amount: 200000, categoryId: 'market', date: '2026-10-10' });
  store.addTransaction({ type: 'expense', amount: 300000, categoryId: 'market', date: '2026-11-10' });
  store.addTransaction({ type: 'expense', amount: 10000, categoryId: 'ulasim', date: '2026-10-10' });
  store.addTransaction({ type: 'expense', amount: 11000, categoryId: 'ulasim', date: '2026-11-10' });
  const notes = gentleInsights(store.getState(), '2026-11');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].text, 'Bu ay market geçen aydan biraz fazla, bir göz atalım mı?');
});

test('demo verisi geleceğe kayıt eklemez', () => {
  const store = createStore(createMemoryAdapter());
  store.loadDemoData('2026-11-02');
  const { transactions, payments } = store.getState();
  assert.ok(transactions.length > 5);
  assert.ok(transactions.every((t) => t.date <= '2026-11-02'));
  assert.equal(payments.length, 7); // 6 ödeme + 1 sabit gelir (maaş)
});

test('html şablonu kullanıcı metnini kaçışlar', () => {
  const note = '<img src=x onerror=alert(1)>';
  assert.equal(String(html`<p>${note}</p>`), '<p>&lt;img src=x onerror=alert(1)&gt;</p>');
  assert.equal(String(html`<ul>${[1, 2].map((n) => html`<li>${n}</li>`)}</ul>`), '<ul><li>1</li><li>2</li></ul>');
});

test('aylar arası: kullanılabilir aylar, toplamlar ve kalemler', async () => {
  const { availableMonths, lastMonths, monthlyTotals, categoryComparison, itemComparison, changeBetween } = await import('../js/domain/compare.js');
  const store = createStore(createMemoryAdapter());
  store.addTransaction({ type: 'expense', amount: 70000, categoryId: 'ulasim', note: 'Akbil', date: '2026-09-12' });
  store.addTransaction({ type: 'expense', amount: 75000, categoryId: 'ulasim', note: 'akbil ', date: '2026-11-02' });
  store.addTransaction({ type: 'expense', amount: 150000, categoryId: 'market', note: 'Pazar', date: '2026-10-05' });
  store.addTransaction({ type: 'expense', amount: 20000, categoryId: 'saglik', date: '2026-11-01' });
  store.addTransaction({ type: 'income', amount: 4000000, categoryId: 'maas', date: '2026-11-01' });
  const state = store.getState();

  assert.deepEqual(availableMonths(state, '2026-11-02'), ['2026-11', '2026-10', '2026-09']);
  assert.deepEqual(availableMonths(createStore(createMemoryAdapter()).getState(), '2026-01-05'), ['2026-01', '2025-12']);
  assert.deepEqual(lastMonths('2026-01', 3), ['2025-11', '2025-12', '2026-01']);

  const months = ['2026-09', '2026-10', '2026-11'];
  assert.deepEqual(monthlyTotals(state, months).map((t) => [t.income, t.expense]), [[0, 70000], [0, 150000], [4000000, 95000]]);

  const cats = categoryComparison(state, months);
  assert.deepEqual(cats.find((c) => c.id === 'ulasim').values, [70000, 0, 75000]);
  assert.equal(cats.find((c) => c.id === 'ulasim').change, 5000);

  const items = itemComparison(state, months);
  const akbil = items.find((i) => i.id === 'not:akbil');
  assert.deepEqual(akbil.values, [70000, 0, 75000]); // "Akbil" ve "akbil " aynı kalem
  assert.equal(akbil.count, 2);
  assert.equal(items.find((i) => i.id === 'kategori:saglik').label, 'Sağlık (notsuz)');
  assert.equal(items.find((i) => i.id === 'not:pazar').change, null); // ilk ve son ayda yok: karşılaştırılamaz
  // Sağlık sadece Kasım'da var: Ekim'le kıyaslanacak tutar yok, değişim "—"
  assert.equal(items.find((i) => i.id === 'kategori:saglik').change, null);
  assert.equal(categoryComparison(state, ['2026-10', '2026-11']).find((c) => c.id === 'saglik').change, null);
  assert.equal(changeBetween([0, 4000000]), null); // gelir: Ekim'de yok
  assert.equal(changeBetween([150000, 95000]), -55000);
  assert.equal(changeBetween([5000]), null); // tek ay
});

test('sabit ödeme: her ay kendiliğinden eklenir, atlanabilir, silinince geri gelmez', () => {
  const store = createStore(createMemoryAdapter());
  const p = store.addPayment({ name: 'Kira', kind: 'kira', amount: 1500000, dayOfMonth: 3, fixed: true, startMonth: '2026-09', categoryId: 'kira' });

  assert.equal(store.syncFixedPayments('2026-11-02'), 2); // Eylül ve Ekim; Kasım'ın 3'ü henüz gelmedi
  assert.equal(store.syncFixedPayments('2026-11-02'), 0); // tekrar çağırmak güvenli
  let s = monthSummary(store.getState(), '2026-10');
  assert.equal(s.expense, 1500000);
  assert.equal(s.byCategory[0].category.id, 'kira');

  // Yaklaşan ödemelerde Kasım 3 görünür
  const [next] = upcomingPayments(store.getState().payments, '2026-11-02');
  assert.equal(next.dueDate, '2026-11-03');
  assert.equal(next.payment.fixed, true);

  assert.equal(store.syncFixedPayments('2026-11-03'), 1);
  assert.equal(statusText(paymentStatus(store.getState().payments[0], '2026-11', '2026-11-03')), 'Eklendi');

  // Kaydı silmek o ayı "atlandı" yapar; eşitleme yeniden eklemez
  const novTx = store.getState().transactions.find((t) => t.date === '2026-11-03');
  store.deleteTransaction(novTx.id);
  assert.equal(store.syncFixedPayments('2026-11-05'), 0);
  assert.equal(paymentStatus(store.getState().payments[0], '2026-11', '2026-11-05').state, 'skipped');

  // "Yine de ekle" -> işaret kalkar, eşitleme geri ekler
  store.unmarkPaymentPaid(p.id, '2026-11');
  assert.equal(store.syncFixedPayments('2026-11-05'), 1);

  // Bu ay atla
  store.skipFixedMonth(p.id, '2026-11');
  assert.equal(monthSummary(store.getState(), '2026-11').expense, 0);

  // Geri al ile ödeme tüm geçmişiyle silinir
  store.deletePayment(p.id, { withHistory: true });
  assert.equal(store.getState().transactions.length, 0);
});

test('ödeme simgeleri adına göre seçilir', async () => {
  const { paymentIcon } = await import('../js/domain/categories.js');
  const icon = (name, kind = 'fatura') => paymentIcon({ name, kind });
  assert.equal(icon('İnternet'), '📶');
  assert.equal(icon('Ev interneti'), '📶');
  assert.equal(icon('Doğalgaz'), '🔥');
  assert.equal(icon('Doğal gaz faturası'), '🔥');
  assert.equal(icon('Elektrik'), '💡');
  assert.equal(icon('Su'), '💧');
  assert.equal(icon('Susam'), '🧾'); // "su" ile başlıyor diye su sayılmaz
  assert.equal(icon('Telefon'), '📱');
  assert.equal(icon('Kira', 'kira'), '🏠');
  assert.equal(icon('Kredi kartı', 'kredi_karti'), '💳');
});

test('grafik serileri: ilk 24 kalemin hepsi farklı görünür', async () => {
  const { seriesStyle } = await import('../js/ui/charts.js');
  const styles = Array.from({ length: 24 }, (_, i) => JSON.stringify(seriesStyle(i)));
  assert.equal(new Set(styles).size, 24);
});

test('ev ekonomisi: günlük limit, ay sonu tahmini, tasarruf, 50/30/20, yıllık maliyet', async () => {
  const eco = await import('../js/domain/economy.js');
  const store = createStore(createMemoryAdapter());
  store.setMonthlyBudget(3000000); // ₺30.000
  const rent = store.addPayment({ name: 'Kira', kind: 'kira', amount: 1500000, dayOfMonth: 15, fixed: true, startMonth: '2026-10', categoryId: 'kira' });
  store.addPayment({ name: 'Elektrik', kind: 'fatura', amount: 0, dayOfMonth: 8 });
  store.addPayment({ name: 'Kredi kartı', kind: 'kredi_karti', amount: 500000, dayOfMonth: 20 });
  store.syncFixedPayments('2026-10-31'); // Ekim kirası eklendi
  // Ekim: gelir 40.000, market 6.000, eğlence 2.000, elektrik 800 (+ kira 15.000)
  store.addTransaction({ type: 'income', amount: 4000000, categoryId: 'maas', date: '2026-10-01' });
  store.addTransaction({ type: 'expense', amount: 600000, categoryId: 'market', date: '2026-10-05' });
  store.addTransaction({ type: 'expense', amount: 200000, categoryId: 'eglence', date: '2026-10-06' });
  store.addTransaction({ type: 'expense', amount: 80000, categoryId: 'fatura', note: 'Elektrik', date: '2026-10-08' });
  // Kasım 1-10: market 3.000
  store.addTransaction({ type: 'expense', amount: 300000, categoryId: 'market', date: '2026-11-04' });
  const state = store.getState();

  // Günlük limit (10 Kasım): 30.000 - 3.000 - kira 15.000 (kart ayrılmaz) = 12.000 ÷ 21 gün
  const a = eco.dailyAllowance(state, '2026-11-10');
  assert.equal(a.upcoming, 1500000);
  assert.equal(a.remaining, 1200000);
  assert.equal(a.daysLeft, 21);
  assert.equal(a.perDay, 57100); // 12.000 ÷ 21 = 571,43 -> ₺571 (aşağı yuvarlanır)
  assert.equal(eco.dailyAllowance({ ...state, settings: { monthlyBudget: 0 } }, '2026-11-10'), null);

  // Ay sonu tahmini (10 Kasım, bu ayın temposu): 3.000 + 300/gün × 20 gün + kira 15.000 = 24.000
  const f = eco.monthEndForecast(state, '2026-11-10');
  assert.equal(f.basedOn, 'this');
  assert.equal(f.forecast, 2400000);
  // Ayın 2'si: tempo geçen aydan (kira hariç Ekim günlük harcaması 8.800 ÷ 31)
  assert.equal(eco.monthEndForecast(state, '2026-11-02').basedOn, 'last');

  // Tasarruf: Ekim gider 23.800, gelir 40.000 -> %40,5
  const s = eco.savingsRate(state, '2026-11-10');
  assert.equal(s.month.saved, 1620000);
  assert.equal(Math.round(s.month.rate * 1000), 405);

  // 50/30/20: zorunlu = kira + market + fatura = 21.800; isteğe bağlı = eğlence 2.000
  const split = eco.needsWantsSavings(state, '2026-10');
  assert.deepEqual(split.parts.map((p) => p.amount), [2180000, 200000, 1620000]);

  // Yıllık: kira 15.000 × 12; elektrik ortalaması 800 × 12; kredi kartı dahil değil
  const y = eco.yearlyCosts(state, '2026-11-10');
  assert.deepEqual(y.rows.map((r) => [r.payment.name, r.yearly, r.estimated]), [['Kira', 18000000, false], ['Elektrik', 960000, true]]);
  assert.equal(y.billsLast12, 80000);
  assert.ok(rent);
});

test('sabit gelir: her ay gelire eklenir, ödeme listelerine ve bütçe hesaplarına karışmaz', async () => {
  const eco = await import('../js/domain/economy.js');
  const store = createStore(createMemoryAdapter());
  store.setMonthlyBudget(3000000);
  store.addPayment({ name: 'Maaş', kind: 'diger', amount: 4200000, dayOfMonth: 1, fixed: true, startMonth: '2026-10', categoryId: 'maas', direction: 'income' });
  assert.equal(store.syncFixedPayments('2026-11-02'), 2);
  const state = store.getState();
  assert.ok(state.transactions.every((t) => t.type === 'income' && t.categoryId === 'maas'));
  assert.equal(monthSummary(state, '2026-11').income, 4200000);
  assert.equal(upcomingPayments(state.payments, '2026-11-02').length, 0);
  assert.equal(eco.dailyAllowance(state, '2026-11-02').upcoming, 0);
  assert.equal(eco.yearlyCosts(state, '2026-11-02').rows.length, 0);
  assert.equal(statusText(paymentStatus(state.payments[0], '2026-12', '2026-11-02')), '29 gün sonra');
});

test('yedek: indirilen dosya geri yüklenince veri aynen döner, bozuk dosya reddedilir', async () => {
  const { createBackup, parseBackup, BackupError } = await import('../js/data/backup.js');
  const store = createStore(createMemoryAdapter());
  store.setMonthlyBudget(3000000);
  store.addTransaction({ type: 'expense', amount: 45000, categoryId: 'market', note: 'Pazar <b>', date: '2026-11-02' });
  store.addPayment({ name: 'Kira', kind: 'kira', amount: 1500000, dayOfMonth: 1, fixed: true, startMonth: '2026-11' });
  store.syncFixedPayments('2026-11-03');
  const original = store.getState();

  const backup = parseBackup(createBackup(original, '2026-11-03'));
  assert.deepEqual(backup.counts, { transactions: 2, payments: 1 });
  assert.equal(backup.exportedAt, '2026-11-03');

  const other = createStore(createMemoryAdapter());
  other.importData(backup.data);
  assert.deepEqual(other.getState().transactions, original.transactions);
  assert.deepEqual(other.getState().payments, original.payments);
  assert.equal(other.getState().settings.monthlyBudget, 3000000);
  // Yüklenen sabit ödeme tekrar eklenmez
  assert.equal(other.syncFixedPayments('2026-11-03'), 0);

  assert.throws(() => parseBackup('{bozuk'), BackupError);
  assert.throws(() => parseBackup(JSON.stringify({ foo: 1 })), BackupError);
  assert.throws(() => parseBackup(JSON.stringify({ app: 'butcedostum', backupVersion: 99, data: {} })), BackupError);
  const broken = JSON.parse(createBackup(original, '2026-11-03'));
  broken.data.transactions[0].amount = '450';
  assert.throws(() => parseBackup(JSON.stringify(broken)), BackupError);
});

test('ad değişikliği: Ev Defteri verisi ve yedekleri Bütçe Dostum\'a taşınır', async () => {
  const { createLocalStorageAdapter } = await import('../js/data/storage.js');
  const { parseBackup } = await import('../js/data/backup.js');
  const mem = new Map([['evdefteri', JSON.stringify({ version: 1, transactions: [], payments: [], settings: { monthlyBudget: 500000, onboarded: true } })]]);
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
  try {
    const store = createStore(createLocalStorageAdapter());
    assert.equal(store.getState().settings.monthlyBudget, 500000); // eski anahtardan okundu
    assert.ok(mem.has('evdefteri')); // henüz bir şey kaydedilmeden eski veri silinmez
    store.setMonthlyBudget(600000);
    assert.deepEqual([...mem.keys()], ['butcedostum']);
    assert.equal(JSON.parse(mem.get('butcedostum')).settings.monthlyBudget, 600000);
  } finally {
    delete globalThis.localStorage;
  }
  // Eski adla alınmış yedek de yüklenir
  assert.equal(parseBackup(JSON.stringify({ app: 'evdefteri', backupVersion: 1, data: { transactions: [], payments: [] } })).counts.transactions, 0);
});
