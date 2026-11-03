// Özetler, yaklaşan ödemeler ve yumuşak dilli mesajlar. Saf fonksiyonlar: veri girer, sonuç çıkar.

import { findCategory } from './categories.js';
import { addMonths, daysBetween, dueDateIn, monthKeyOf } from './dates.js';

export function transactionsInMonth(transactions, key) {
  return transactions.filter((t) => monthKeyOf(t.date) === key);
}

function sumBy(list, type) {
  return list.reduce((sum, t) => (t.type === type ? sum + t.amount : sum), 0);
}

export function monthSummary(state, key) {
  const list = transactionsInMonth(state.transactions, key);
  const expense = sumBy(list, 'expense');
  const income = sumBy(list, 'income');
  const budget = state.settings.monthlyBudget || 0;

  const totals = new Map();
  for (const t of list) {
    if (t.type === 'expense') totals.set(t.categoryId, (totals.get(t.categoryId) || 0) + t.amount);
  }
  const byCategory = [...totals]
    .map(([id, amount]) => ({ category: findCategory('expense', id), amount, share: expense ? amount / expense : 0 }))
    .sort((a, b) => b.amount - a.amount);

  return {
    key,
    expense,
    income,
    balance: income - expense,
    budget,
    usedRatio: budget ? expense / budget : null,
    remaining: budget ? budget - expense : null,
    byCategory,
    count: list.length,
  };
}

/** Sabit gelir (maaş gibi) mi? Bunlar ödeme listelerine ve bütçe hesaplarına karışmaz. */
export const isIncomePayment = (p) => p.direction === 'income';

/** Bir düzenli ödemenin verilen aydaki durumu. */
export function paymentStatus(payment, key, today) {
  const dueDate = dueDateIn(key, payment.dayOfMonth);
  const paidInfo = payment.paidMonths?.[key] ?? null;
  const daysLeft = daysBetween(today, dueDate);
  let state;
  if (paidInfo?.skipped) state = 'skipped';
  else if (paidInfo) state = 'paid';
  else if (daysLeft < 0) state = 'overdue';
  else if (daysLeft === 0) state = 'today';
  else if (daysLeft <= 3) state = 'soon';
  else state = 'upcoming';
  return { payment, key, dueDate, daysLeft, state, paidInfo };
}

/**
 * Ödenmemiş en yakın ödemeler: bu ayın ödenmemişleri (tarihi geçenler dahil),
 * bu ayki ödendiyse bir sonraki ayınki.
 */
export function upcomingPayments(payments, today, limit = Infinity) {
  const thisMonth = monthKeyOf(today);
  return payments
    .filter((p) => p.active !== false && !isIncomePayment(p))
    .map((p) => {
      const current = paymentStatus(p, thisMonth, today);
      const done = current.state === 'paid' || current.state === 'skipped';
      return done ? paymentStatus(p, addMonths(thisMonth, 1), today) : current;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, limit);
}

/** Durum için kısa, yargılamayan etiket. */
export function statusText(status) {
  const { state, daysLeft } = status;
  if (state === 'paid') return status.paidInfo?.auto ? 'Eklendi' : 'Ödendi';
  // Gelirin "tarihi geçmesi" diye bir şey yok; sadece ne zaman geleceği söylenir.
  if (isIncomePayment(status.payment) && state !== 'skipped') {
    return daysLeft === 0 ? 'Bugün' : daysLeft === 1 ? 'Yarın' : `${daysLeft} gün sonra`;
  }
  if (state === 'skipped') return 'Bu ay atlandı';
  if (state === 'today') return 'Bugün';
  if (state === 'overdue') return `Tarihi ${-daysLeft} gün geçti`;
  if (daysLeft === 1) return 'Yarın';
  return `${daysLeft} gün kaldı`;
}

/** Bütçe kullanımına göre sıcak bir cümle. */
export function budgetMessage(usedRatio) {
  if (usedRatio == null) return null;
  if (usedRatio < 0.5) return { tone: 'calm', icon: '🌿', text: 'Ay rahat gidiyor.' };
  if (usedRatio < 0.8) return { tone: 'calm', icon: '🙂', text: 'Her şey yolunda görünüyor.' };
  if (usedRatio < 1) return { tone: 'notice', icon: '🧭', text: 'Bütçenin sonuna yaklaşıyoruz, biraz dikkat edelim mi?' };
  return { tone: 'notice', icon: '🤝', text: 'Bu ay bütçeyi biraz geçtik. Birlikte bir göz atalım mı?' };
}

/**
 * Geçen aya göre belirgin artan kategoriler için nazik notlar.
 * En az %20 ve en az 100 TL artış olmalı ki her küçük farkta kullanıcı rahatsız edilmesin.
 */
export function gentleInsights(state, key) {
  const now = monthSummary(state, key);
  const prev = monthSummary(state, addMonths(key, -1));
  const prevMap = new Map(prev.byCategory.map((c) => [c.category.id, c.amount]));
  const notes = [];
  for (const { category, amount } of now.byCategory) {
    const before = prevMap.get(category.id) || 0;
    if (before > 0 && amount >= before * 1.2 && amount - before >= 10000) {
      notes.push({
        category,
        current: amount,
        previous: before,
        text: `Bu ay ${category.label.toLocaleLowerCase('tr')} geçen aydan biraz fazla, bir göz atalım mı?`,
      });
    }
  }
  return notes;
}
