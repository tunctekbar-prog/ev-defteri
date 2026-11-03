// İleri ev ekonomisi: günlük harcanabilir limit, ay sonu tahmini, tasarruf oranı, 50/30/20 dağılımı,
// düzenli ödemelerin yıllık maliyeti. Saf fonksiyonlar; hepsi kuruş cinsinden çalışır.

import { isIncomePayment, monthSummary, paymentStatus, transactionsInMonth } from './budget.js';
import { itemKey } from './compare.js';
import { addMonths, daysInMonth, monthKeyOf } from './dates.js';

/** Bir düzenli ödemeye bağlı (Ödedim / sabit ödeme ile eklenmiş) harcamaların id'leri. */
function linkedTransactionIds(state) {
  const ids = new Set();
  for (const p of state.payments) {
    for (const info of Object.values(p.paidMonths || {})) if (info.transactionId) ids.add(info.transactionId);
  }
  return ids;
}

/**
 * Bu ay henüz ödenmemiş, tutarı bilinen ödemeler (kira, aidat, internet…).
 * Kredi kartı hariç: kart harcamaları genelde zaten tek tek giriliyor.
 */
export function upcomingKnownPayments(state, today) {
  const key = monthKeyOf(today);
  return state.payments
    .filter((p) => p.active !== false && p.amount > 0 && p.kind !== 'kredi_karti' && !isIncomePayment(p))
    .map((p) => paymentStatus(p, key, today))
    .filter((s) => s.state !== 'paid' && s.state !== 'skipped');
}

const sum = (list, fn) => list.reduce((total, x) => total + fn(x), 0);

/** Tahminler kuruşlu gösterilmez: tam liraya yuvarla (aşağı: limit asla fazla gösterilmesin). */
const floorLira = (kurus) => Math.floor(kurus / 100) * 100;
const roundLira = (kurus) => Math.round(kurus / 100) * 100;

/** "Bugün en fazla şu kadar harcarsan rahatsın": (bütçe - harcanan - yaklaşan ödemeler) ÷ kalan gün. */
export function dailyAllowance(state, today) {
  const budget = state.settings.monthlyBudget || 0;
  if (!budget) return null;
  const key = monthKeyOf(today);
  const spent = monthSummary(state, key).expense;
  const upcoming = sum(upcomingKnownPayments(state, today), (s) => s.payment.amount);
  const daysLeft = daysInMonth(key) - Number(today.slice(8)) + 1; // bugün dahil
  const remaining = budget - spent - upcoming;
  return { budget, spent, upcoming, daysLeft, remaining, perDay: Math.max(0, floorLira(remaining / daysLeft)) };
}

/** Bir aydaki "gündelik" harcama: düzenli ödemelere bağlı olmayanlar (market, ulaşım…). */
function dailySpend(state, key, linked) {
  return sum(
    transactionsInMonth(state.transactions, key).filter((t) => t.type === 'expense' && !linked.has(t.id)),
    (t) => t.amount,
  );
}

/**
 * Ay sonu tahmini = şimdiye kadar harcanan + gündelik harcama temposu × kalan gün + yaklaşan bilinen ödemeler.
 * Ayın ilk haftasında veri az olduğu için tempo geçen aydan alınır.
 */
export function monthEndForecast(state, today) {
  const key = monthKeyOf(today);
  const day = Number(today.slice(8));
  const linked = linkedTransactionIds(state);
  const spent = monthSummary(state, key).expense;
  const upcoming = sum(upcomingKnownPayments(state, today), (s) => s.payment.amount);
  const lastKey = addMonths(key, -1);
  const lastDaily = dailySpend(state, lastKey, linked);

  let pace;
  let basedOn;
  if (day >= 7 || !lastDaily) {
    pace = dailySpend(state, key, linked) / day;
    basedOn = 'this';
  } else {
    pace = lastDaily / daysInMonth(lastKey);
    basedOn = 'last';
  }
  if (!spent && !pace && !upcoming) return null;
  const daysLeft = daysInMonth(key) - day;
  const forecast = roundLira(spent + pace * daysLeft + upcoming);
  const budget = state.settings.monthlyBudget || 0;
  return { forecast, spent, upcoming, pace: roundLira(pace), daysLeft, basedOn, budget };
}

/** En son tamamlanmış ay (bu ay bitmediği için oranlar ondan hesaplanır). */
export function lastFullMonth(today) {
  return addMonths(monthKeyOf(today), -1);
}

/** Gelirin ne kadarı cepte kaldı: (gelir - gider) ÷ gelir. Son 3 tam ayın ortalamasıyla birlikte. */
export function savingsRate(state, today) {
  const rate = (key) => {
    const s = monthSummary(state, key);
    return s.income ? { key, income: s.income, expense: s.expense, saved: s.balance, rate: s.balance / s.income } : null;
  };
  const last = lastFullMonth(today);
  const recent = [0, 1, 2].map((i) => rate(addMonths(last, -i))).filter(Boolean);
  if (!recent.length) return null;
  const avg = sum(recent, (r) => r.saved) / sum(recent, (r) => r.income);
  return { month: rate(last), average: avg, months: recent.length };
}

/** 50/30/20 için kategori grupları. "Diğer" isteğe bağlı sayılır. */
export const NEEDS = new Set(['market', 'ulasim', 'fatura', 'kira', 'saglik', 'cocuk']);

/** Gelirin zorunlu / isteğe bağlı / artan olarak bölünüşü (önerilen: %50 / %30 / %20). */
export function needsWantsSavings(state, key) {
  const s = monthSummary(state, key);
  if (!s.income) return null;
  const needs = sum(s.byCategory.filter((c) => NEEDS.has(c.category.id)), (c) => c.amount);
  const wants = s.expense - needs;
  const saved = s.income - s.expense;
  return {
    key,
    income: s.income,
    parts: [
      { id: 'needs', label: 'Zorunlu', hint: 'kira, fatura, market, ulaşım, sağlık, çocuk', amount: needs, share: needs / s.income, target: 0.5 },
      { id: 'wants', label: 'İsteğe bağlı', hint: 'eğlence ve diğer', amount: wants, share: wants / s.income, target: 0.3 },
      { id: 'saved', label: 'Artan', hint: 'cepte kalan', amount: saved, share: saved / s.income, target: 0.2 },
    ],
  };
}

/**
 * Düzenli ödemelerin yıllık maliyeti. Tutarı sabit olanlar: aylık × 12.
 * Değişenler (elektrik, doğalgaz): son 12 ayda aynı adla girilen harcamaların aylık ortalaması × 12.
 */
export function yearlyCosts(state, today) {
  const thisMonth = monthKeyOf(today);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(thisMonth, -i));
  const recent = state.transactions.filter((t) => t.type === 'expense' && months.includes(monthKeyOf(t.date)));

  const rows = state.payments
    .filter((p) => p.active !== false && p.kind !== 'kredi_karti' && !isIncomePayment(p))
    .map((p) => {
      if (p.amount > 0) return { payment: p, monthly: p.amount, yearly: p.amount * 12, estimated: false };
      const key = `not:${p.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr')}`;
      const own = recent.filter((t) => itemKey(t) === key);
      const monthCount = new Set(own.map((t) => monthKeyOf(t.date))).size;
      if (!monthCount) return { payment: p, monthly: 0, yearly: 0, estimated: true, noData: true };
      const monthly = roundLira(sum(own, (t) => t.amount) / monthCount);
      return { payment: p, monthly, yearly: monthly * 12, estimated: true, monthCount };
    })
    .sort((a, b) => b.yearly - a.yearly);

  const billsLast12 = sum(recent.filter((t) => t.categoryId === 'fatura'), (t) => t.amount);
  return { rows, total: sum(rows, (r) => r.yearly), billsLast12 };
}
