// Aylar arası karşılaştırma: seçilen aylar için gelen/giden, kategori ve kalem (Akbil, Pazar…) tabloları.
// Saf fonksiyonlar: aylar her zaman eskiden yeniye sıralı "YYYY-MM" listesidir.

import { findCategory } from './categories.js';
import { addMonths, monthKeyOf } from './dates.js';
import { monthSummary } from './budget.js';

/** İlk kayıttan bu aya kadar tüm aylar (en yeni başta). En az bu ay ve geçen ay. */
export function availableMonths(state, today) {
  const thisMonth = monthKeyOf(today);
  const earliest = state.transactions.reduce((min, t) => {
    const key = monthKeyOf(t.date);
    return key < min ? key : min;
  }, addMonths(thisMonth, -1));
  const months = [];
  for (let key = thisMonth; key >= earliest; key = addMonths(key, -1)) months.push(key);
  return months;
}

/** Son n ay, eskiden yeniye: lastMonths('2026-11', 2) -> ['2026-10', '2026-11'] */
export function lastMonths(thisMonth, n) {
  return Array.from({ length: n }, (_, i) => addMonths(thisMonth, i - n + 1));
}

export function monthlyTotals(state, months) {
  return months.map((key) => {
    const s = monthSummary(state, key);
    return { key, income: s.income, expense: s.expense, balance: s.balance };
  });
}

/**
 * İlk ve son seçili ay arasındaki fark. Aylardan birinde hiç tutar yoksa karşılaştırılacak
 * bir şey yok demektir: null döner (ekranda "—").
 */
export function changeBetween(values) {
  const first = values[0];
  const last = values[values.length - 1];
  return values.length > 1 && first && last ? last - first : null;
}

function withChange(row) {
  return { ...row, change: changeBetween(row.values), total: row.values.reduce((a, b) => a + b, 0) };
}

/** Harcama kategorileri × aylar. Hiç harcaması olmayan kategoriler gösterilmez. */
export function categoryComparison(state, months) {
  const perMonth = months.map((key) => new Map(monthSummary(state, key).byCategory.map((c) => [c.category.id, c])));
  const ids = new Set(perMonth.flatMap((m) => [...m.keys()]));
  return [...ids]
    .map((id) =>
      withChange({
        id,
        label: findCategory('expense', id).label,
        icon: findCategory('expense', id).icon,
        values: perMonth.map((m) => m.get(id)?.amount || 0),
      }),
    )
    .sort((a, b) => b.total - a.total);
}

/** Notu aynı olan harcamalar bir "kalem" sayılır: "akbil", "Akbil " ve "AKBİL" aynıdır. */
export function itemKey(t) {
  const note = t.note?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr');
  return note ? `not:${note}` : `kategori:${t.categoryId}`;
}

/**
 * Kalem bazında detaylı karşılaştırma. Notu olmayan harcamalar kategorisi adıyla
 * "(notsuz)" kalemi olarak toplanır.
 */
export function itemComparison(state, months) {
  const index = new Map(months.map((key, i) => [key, i]));
  const items = new Map();
  const sorted = [...state.transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of sorted) {
    if (t.type !== 'expense') continue;
    const i = index.get(monthKeyOf(t.date));
    if (i === undefined) continue;
    const id = itemKey(t);
    const category = findCategory('expense', t.categoryId);
    if (!items.has(id)) {
      items.set(id, { id, values: months.map(() => 0), count: 0, label: '', icon: category.icon });
    }
    const item = items.get(id);
    item.values[i] += t.amount;
    item.count += 1;
    // En son yazılış biçimini ve kategorisini göster
    item.label = t.note?.trim() || `${category.label} (notsuz)`;
    item.icon = category.icon;
  }
  return [...items.values()].map(withChange).sort((a, b) => b.total - a.total);
}
