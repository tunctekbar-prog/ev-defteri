// Uygulama verisinin tek kaynağı. Ekranlar veriyi yalnızca buradaki fonksiyonlarla değiştirir.
//
// Veri şekli (sürüm 1):
//   transactions: [{ id, type: 'expense'|'income', amount (kuruş), categoryId, note, date: 'YYYY-MM-DD', createdAt }]
//   payments:     [{ id, name, kind, amount (kuruş, 0 = değişken), dayOfMonth, active,
//                    fixed (sabit: her ay kendiliğinden harcamaya eklenir), startMonth ('YYYY-MM'),
//                    categoryId (isteğe bağlı; yoksa türünün kategorisi),
//                    direction ('income' = sabit gelir, ör. maaş; yoksa gider),
//                    paidMonths: { 'YYYY-MM': { amount, date, transactionId|null, auto?, skipped? } } }]
//   settings:     { monthlyBudget (kuruş), onboarded, lastBackupAt ('YYYY-MM-DD', isteğe bağlı) }

import { findPaymentKind } from '../domain/categories.js';
import { addMonths, dueDateIn, monthKeyOf } from '../domain/dates.js';
import { buildDemoData } from './demo.js';

export const SCHEMA_VERSION = 1;

function emptyState() {
  return {
    version: SCHEMA_VERSION,
    transactions: [],
    payments: [],
    settings: { monthlyBudget: 0, onboarded: false },
  };
}

/** Eski sürüm verileri burada yeni şekle çevrilir. */
function migrate(data) {
  if (!data || typeof data !== 'object') return emptyState();
  const base = emptyState();
  return {
    ...base,
    ...data,
    settings: { ...base.settings, ...data.settings },
    version: SCHEMA_VERSION,
  };
}

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function createStore(adapter) {
  let state = migrate(adapter.load());
  const listeners = new Set();

  function commit(next) {
    state = next;
    adapter.save(state);
    listeners.forEach((fn) => fn(state));
  }

  function updatePaymentById(id, fn) {
    return state.payments.map((p) => (p.id === id ? fn(p) : p));
  }

  /** Ödemenin (veya sabit gelirin) o ay için oluşturduğu kayıt. */
  function paymentTransaction(payment, amount, date) {
    return {
      id: newId(),
      type: payment.direction === 'income' ? 'income' : 'expense',
      amount,
      categoryId: payment.categoryId ?? findPaymentKind(payment.kind).expenseCategory,
      note: payment.name,
      date,
      createdAt: Date.now(),
    };
  }

  return {
    getState: () => state,

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    // --- Harcama / gelir ---

    addTransaction({ type, amount, categoryId, note = '', date }) {
      const tx = { id: newId(), type, amount, categoryId, note: note.trim(), date, createdAt: Date.now() };
      commit({ ...state, transactions: [...state.transactions, tx] });
      return tx;
    },

    /** Kaydı siler; "Geri al" için restoreTransaction'a verilecek bilgiyi döndürür. */
    deleteTransaction(id) {
      const transaction = state.transactions.find((t) => t.id === id);
      if (!transaction) return null;
      // Bir ödemeye bağlı kayıt silinirse o ödeme de "ödenmedi"ye döner.
      let link = null;
      const payments = state.payments.map((p) => {
        const entry = Object.entries(p.paidMonths || {}).find(([, info]) => info.transactionId === id);
        if (!entry) return p;
        link = { paymentId: p.id, monthKey: entry[0], info: entry[1] };
        const paidMonths = { ...p.paidMonths };
        // Sabit ödemede o ay "atlandı" olarak kalır; yoksa bir sonraki eşitlemede yeniden eklenirdi.
        if (p.fixed) paidMonths[entry[0]] = { skipped: true, amount: 0, date: entry[1].date, transactionId: null };
        else delete paidMonths[entry[0]];
        return { ...p, paidMonths };
      });
      commit({ ...state, payments, transactions: state.transactions.filter((t) => t.id !== id) });
      return { transaction, link };
    },

    /** "Geri al": silinen kaydı (ve varsa ödeme bağlantısını) aynen geri koyar. */
    restoreTransaction({ transaction, link }) {
      const payments = link
        ? updatePaymentById(link.paymentId, (p) => ({ ...p, paidMonths: { ...p.paidMonths, [link.monthKey]: link.info } }))
        : state.payments;
      commit({ ...state, payments, transactions: [...state.transactions, transaction] });
    },

    // --- Ayarlar ---

    setMonthlyBudget(amount) {
      commit({ ...state, settings: { ...state.settings, monthlyBudget: amount, onboarded: true } });
    },

    finishOnboarding() {
      commit({ ...state, settings: { ...state.settings, onboarded: true } });
    },

    loadDemoData(today) {
      commit({ ...buildDemoData(today, newId), version: SCHEMA_VERSION });
    },

    resetAll() {
      commit(emptyState());
    },

    // --- Yedek ---

    /** Yedekten gelen (veya "Geri al" için saklanan) veriyi olduğu gibi yükler. */
    importData(data) {
      const next = migrate(data);
      commit({ ...next, settings: { ...next.settings, onboarded: true } });
    },

    markBackedUp(today) {
      commit({ ...state, settings: { ...state.settings, lastBackupAt: today } });
    },

    // --- Düzenli ödemeler ---

    addPayment({ name, kind, amount = 0, dayOfMonth, fixed = false, startMonth, categoryId, direction }) {
      const payment = { id: newId(), name: name.trim(), kind, amount, dayOfMonth, active: true, paidMonths: {} };
      if (direction === 'income') payment.direction = 'income';
      if (fixed) Object.assign(payment, { fixed: true, startMonth });
      if (categoryId) payment.categoryId = categoryId;
      commit({ ...state, payments: [...state.payments, payment] });
      return payment;
    },

    updatePayment(id, patch) {
      commit({ ...state, payments: updatePaymentById(id, (p) => ({ ...p, ...patch })) });
    },

    /** Ödemeyi siler. withHistory: bu ödeme için eklenmiş harcamaları da sil (ör. "Geri al"). */
    deletePayment(id, { withHistory = false } = {}) {
      const payment = state.payments.find((p) => p.id === id);
      if (!payment) return;
      const linked = new Set(Object.values(payment.paidMonths || {}).map((i) => i.transactionId).filter(Boolean));
      commit({
        ...state,
        payments: state.payments.filter((p) => p.id !== id),
        transactions: withHistory ? state.transactions.filter((t) => !linked.has(t.id)) : state.transactions,
      });
    },

    /**
     * Sabit ödemeleri harcamalara işler: başlangıç ayından bu aya kadar, tarihi gelmiş ve henüz
     * eklenmemiş her ay için bir harcama oluşturur. Tekrar çağrılması güvenlidir. Eklenen kayıt sayısını döndürür.
     */
    syncFixedPayments(today) {
      const thisMonth = monthKeyOf(today);
      const added = [];
      const payments = state.payments.map((p) => {
        if (!p.fixed || p.active === false || !p.amount) return p;
        let paidMonths = p.paidMonths || {};
        for (let key = p.startMonth || thisMonth; key <= thisMonth; key = addMonths(key, 1)) {
          const date = dueDateIn(key, p.dayOfMonth);
          if (paidMonths[key] || date > today) continue;
          const tx = paymentTransaction(p, p.amount, date);
          added.push(tx);
          paidMonths = { ...paidMonths, [key]: { amount: p.amount, date, transactionId: tx.id, auto: true } };
        }
        return paidMonths === p.paidMonths ? p : { ...p, paidMonths };
      });
      if (added.length) commit({ ...state, payments, transactions: [...state.transactions, ...added] });
      return added.length;
    },

    /** Ödemeyi o ay için ödendi işaretler; istenirse harcamalara da ekler. */
    markPaymentPaid(id, monthKey, { amount, date, addAsExpense }) {
      const payment = state.payments.find((p) => p.id === id);
      if (!payment) return;
      let transactions = state.transactions;
      let transactionId = null;
      if (addAsExpense && amount > 0) {
        const tx = paymentTransaction(payment, amount, date);
        transactions = [...transactions, tx];
        transactionId = tx.id;
      }
      const payments = updatePaymentById(id, (p) => ({
        ...p,
        paidMonths: { ...p.paidMonths, [monthKey]: { amount, date, transactionId } },
      }));
      commit({ ...state, transactions, payments });
    },

    /** Sabit ödemeyi bu ay için atlar: eklenmiş harcamayı siler, bir daha eklenmesin diye işaretler. */
    skipFixedMonth(id, monthKey) {
      const payment = state.payments.find((p) => p.id === id);
      if (!payment) return;
      const info = payment.paidMonths?.[monthKey];
      commit({
        ...state,
        transactions: info?.transactionId ? state.transactions.filter((t) => t.id !== info.transactionId) : state.transactions,
        payments: updatePaymentById(id, (p) => ({
          ...p,
          paidMonths: { ...p.paidMonths, [monthKey]: { skipped: true, amount: 0, date: info?.date ?? null, transactionId: null } },
        })),
      });
    },

    /** "Ödendi" işaretini kaldırır, eklenmiş harcamayı da siler. */
    unmarkPaymentPaid(id, monthKey) {
      const payment = state.payments.find((p) => p.id === id);
      const info = payment?.paidMonths?.[monthKey];
      if (!info) return;
      const paidMonths = { ...payment.paidMonths };
      delete paidMonths[monthKey];
      commit({
        ...state,
        transactions: info.transactionId ? state.transactions.filter((t) => t.id !== info.transactionId) : state.transactions,
        payments: updatePaymentById(id, (p) => ({ ...p, paidMonths })),
      });
    },
  };
}
