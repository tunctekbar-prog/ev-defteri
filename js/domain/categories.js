// Kategori tanımları. Renk tek başına anlam taşımaz: her kategorinin ikonu ve adı da var.

export const EXPENSE_CATEGORIES = [
  { id: 'market', label: 'Market', icon: '🛒', color: '#7FA37F' },
  { id: 'ulasim', label: 'Ulaşım', icon: '🚌', color: '#C98B5A' },
  { id: 'fatura', label: 'Fatura', icon: '🧾', color: '#D9B44A' },
  { id: 'kira', label: 'Kira, aidat', icon: '🏠', color: '#A3765A' },
  { id: 'saglik', label: 'Sağlık', icon: '💊', color: '#6FA3A0' },
  { id: 'cocuk', label: 'Çocuk', icon: '🧸', color: '#D79A8B' },
  { id: 'eglence', label: 'Eğlence', icon: '🎈', color: '#9C8DB8' },
  { id: 'diger', label: 'Diğer', icon: '📦', color: '#9A9488' },
];

export const INCOME_CATEGORIES = [
  { id: 'maas', label: 'Maaş', icon: '💼', color: '#5E8B68' },
  { id: 'ek_gelir', label: 'Ek gelir', icon: '🌱', color: '#8DB07F' },
  { id: 'emekli', label: 'Emekli maaşı', icon: '🏡', color: '#7E9C6B' },
  { id: 'diger_gelir', label: 'Diğer', icon: '🎁', color: '#A7B59A' },
];

/** Düzenli ödeme türleri ve "ödendi" denince hangi harcama kategorisine yazılacakları. */
export const PAYMENT_KINDS = [
  { id: 'fatura', label: 'Fatura', icon: '🧾', expenseCategory: 'fatura', addAsExpense: true },
  { id: 'kira', label: 'Kira', icon: '🏠', expenseCategory: 'kira', addAsExpense: true },
  { id: 'aidat', label: 'Aidat', icon: '🏢', expenseCategory: 'kira', addAsExpense: true },
  // Kart harcamaları zaten tek tek girildiyse kart ödemesini tekrar saymamak için varsayılan kapalı.
  { id: 'kredi_karti', label: 'Kredi kartı', icon: '💳', expenseCategory: 'diger', addAsExpense: false },
  { id: 'diger', label: 'Diğer', icon: '📅', expenseCategory: 'diger', addAsExpense: true },
];

/** Ödeme ekleme formunda tek dokunuşla doldurulan hazır öneriler. */
export const PAYMENT_SUGGESTIONS = [
  { name: 'Kira', kind: 'kira' },
  { name: 'Elektrik', kind: 'fatura' },
  { name: 'Su', kind: 'fatura' },
  { name: 'Doğalgaz', kind: 'fatura' },
  { name: 'İnternet', kind: 'fatura' },
  { name: 'Telefon', kind: 'fatura' },
  { name: 'Aidat', kind: 'aidat' },
  { name: 'Kredi kartı', kind: 'kredi_karti' },
];

const FALLBACK = { id: 'bilinmiyor', label: 'Diğer', icon: '📦', color: '#9A9488' };

export function categoriesFor(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function findCategory(type, id) {
  return categoriesFor(type).find((c) => c.id === id) ?? FALLBACK;
}

export function findPaymentKind(id) {
  return PAYMENT_KINDS.find((k) => k.id === id) ?? PAYMENT_KINDS[PAYMENT_KINDS.length - 1];
}

/**
 * Ödemenin adına göre tanıdık bir simge: İnternet 📶, Doğalgaz 🔥, Su 💧… Bulamazsa türünün simgesi.
 * Kelime bazında eşleşir: "Su" -> 💧 ama "Susam" değil; "İnternet faturası" -> 📶.
 */
const NAME_ICONS = [
  [['internet', 'modem', 'wifi', 'wi-fi', 'fiber', 'adsl'], '📶'],
  [['doğalgaz', 'dogalgaz', 'gaz', 'kombi'], '🔥'],
  [['elektrik'], '💡'],
  [['su'], '💧'],
  [['telefon', 'gsm', 'cep', 'hat'], '📱'],
  [['televizyon', 'tv', 'dijital', 'netflix', 'uydu'], '📺'],
  [['sigorta', 'dask', 'kasko'], '🛡️'],
  [['okul', 'servis', 'kreş', 'kres'], '🎒'],
  [['taksit', 'kredi'], '🏦'],
];
// Bu kelimeler ekli de olsa eşleşir: "elektriği", "internetin", "telefonu"…
const PREFIX_WORDS = new Set(['internet', 'elektri', 'telefon', 'televizyon', 'sigorta', 'doğalgaz', 'dogalgaz', 'taksit']);

export function paymentIcon(payment) {
  if (payment.kind === 'kredi_karti') return findPaymentKind('kredi_karti').icon;
  const words = (payment.name || '')
    .toLocaleLowerCase('tr')
    .replace(/doğal gaz/g, 'doğalgaz')
    .split(/[^a-zçğıöşü0-9-]+/);
  const prefixes = [...PREFIX_WORDS].filter((p) => words.some((w) => w.startsWith(p)));
  const match = NAME_ICONS.find(([keys]) =>
    keys.some((k) => words.includes(k) || prefixes.some((p) => k.startsWith(p))),
  );
  return match?.[1] ?? findPaymentKind(payment.kind).icon;
}

/** Ekle ekranında "sabit harcama" seçilince harcama kategorisinden ödeme türü. */
export function paymentKindForCategory(categoryId) {
  if (categoryId === 'kira') return 'kira';
  if (categoryId === 'fatura') return 'fatura';
  return 'diger';
}
