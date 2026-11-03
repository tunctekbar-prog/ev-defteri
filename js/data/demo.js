// "Örnek verilerle göz at" için gerçekçi bir iki aylık ev defteri üretir.

import { addMonths, dueDateIn, monthKeyOf } from '../domain/dates.js';

const TL = (n) => Math.round(n * 100);

export function buildDemoData(today, newId) {
  const thisMonth = monthKeyOf(today);
  const lastMonth = addMonths(thisMonth, -1);
  const todayDay = Number(today.slice(8, 10));
  const transactions = [];

  const add = (key, day, type, categoryId, amount, note = '') => {
    const date = dueDateIn(key, day);
    if (date > today) return; // gelecekteki harcamaları ekleme
    transactions.push({ id: newId(), type, amount: TL(amount), categoryId, note, date, createdAt: Date.now() });
  };

  // 2 ve 3 ay önce: aylar arası karşılaştırmada çizgiler boş kalmasın
  [
    [-3, 1, 0.85],
    [-2, 1.08, 1.1],
  ].forEach(([offset, grocery, other]) => {
    const key = addMonths(thisMonth, offset);
    add(key, 1, 'income', 'maas', 40000, 'Maaş');
    if (offset === -2) add(key, 18, 'income', 'ek_gelir', 3500, 'Ek iş');
    add(key, 4, 'expense', 'market', 1700 * grocery, 'Haftalık market');
    add(key, 5, 'expense', 'kira', 15000, 'Kira');
    add(key, 8, 'expense', 'fatura', 780 * other, 'Elektrik');
    add(key, 11, 'expense', 'market', 1500 * grocery, 'Pazar');
    add(key, 12, 'expense', 'ulasim', 700, 'Akbil');
    add(key, 18, 'expense', 'market', 1800 * grocery, 'Haftalık market');
    add(key, 21, 'expense', 'saglik', 320 * other, 'Eczane');
    add(key, 25, 'expense', 'eglence', 600 * other, 'Sinema');
  });

  // Geçen ay
  add(lastMonth, 1, 'income', 'maas', 42000, 'Maaş');
  add(lastMonth, 3, 'expense', 'market', 1850, 'Haftalık market');
  add(lastMonth, 5, 'expense', 'kira', 15000, 'Kira');
  add(lastMonth, 8, 'expense', 'fatura', 920, 'Elektrik');
  add(lastMonth, 10, 'expense', 'market', 2100, 'Haftalık market');
  add(lastMonth, 12, 'expense', 'ulasim', 750, 'Akbil');
  add(lastMonth, 15, 'expense', 'cocuk', 1200, 'Okul kırtasiye');
  add(lastMonth, 17, 'expense', 'market', 1650, 'Pazar');
  add(lastMonth, 20, 'expense', 'saglik', 480, 'Eczane');
  add(lastMonth, 22, 'expense', 'eglence', 900, 'Sinema');
  add(lastMonth, 24, 'expense', 'market', 1900, 'Haftalık market');
  add(lastMonth, 26, 'expense', 'fatura', 640, 'Doğalgaz');

  // Bu ay (bugüne kadar olanlar)
  add(thisMonth, 1, 'income', 'maas', 42000, 'Maaş');
  add(thisMonth, 1, 'expense', 'market', 2450, 'Haftalık market');
  add(thisMonth, 2, 'expense', 'ulasim', 750, 'Akbil');
  add(thisMonth, 2, 'expense', 'cocuk', 350, 'Harçlık');
  add(thisMonth, Math.min(todayDay, 4), 'expense', 'market', 1980, 'Pazar');
  add(thisMonth, Math.min(todayDay, 6), 'expense', 'saglik', 260, 'Eczane');
  add(thisMonth, Math.min(todayDay, 9), 'expense', 'market', 2600, 'Haftalık market');

  const payment = (name, kind, amount, dayOfMonth, fixedFrom = null) => ({
    id: newId(),
    name,
    kind,
    amount: TL(amount),
    dayOfMonth,
    active: true,
    paidMonths: {},
    ...(fixedFrom ? { fixed: true, startMonth: fixedFrom } : {}),
  });
  const payments = [
    payment('Kira', 'kira', 15000, 5, addMonths(thisMonth, -3)),
    payment('Elektrik', 'fatura', 0, 8),
    payment('İnternet', 'fatura', 450, 12, thisMonth),
    payment('Aidat', 'aidat', 1200, 15, thisMonth),
    payment('Kredi kartı', 'kredi_karti', 0, 20),
    payment('Doğalgaz', 'fatura', 0, 26),
  ];

  // Maaş sabit gelir: bu aydan itibaren her ayın 1'inde kendiliğinden eklenir
  const salary = { ...payment('Maaş', 'diger', 42000, 1, thisMonth), direction: 'income', categoryId: 'maas' };
  const salaryTx = transactions.find((t) => t.categoryId === 'maas' && monthKeyOf(t.date) === thisMonth);
  if (salaryTx) salary.paidMonths[thisMonth] = { amount: salaryTx.amount, date: salaryTx.date, transactionId: salaryTx.id, auto: true };
  payments.push(salary);

  // Kira sabit ödeme: geçmiş ayların kira kayıtları ona bağlı (otomatik eklenmiş gibi)
  const rent = payments[0];
  for (const tx of transactions.filter((t) => t.note === 'Kira')) {
    rent.paidMonths[monthKeyOf(tx.date)] = { amount: tx.amount, date: tx.date, transactionId: tx.id, auto: true };
  }

  return {
    transactions,
    payments,
    settings: { monthlyBudget: TL(30000), onboarded: true },
  };
}
