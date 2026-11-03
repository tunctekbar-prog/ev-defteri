// Hızlı giriş: tutarı yaz, kategoriye dokun, bitti. Not ve tarih isteğe bağlı.

import { categoriesFor, findCategory, paymentKindForCategory } from '../../domain/categories.js';
import { monthKeyOf } from '../../domain/dates.js';
import { formatMoney, parseAmount } from '../../domain/money.js';
import { html } from '../html.js';

const TEXT = {
  expense: {
    title: 'Harcama ekle',
    amount: 'Ne kadar tuttu?',
    category: 'Neye harcadın?',
    note: 'Ne aldın? (ör. haftalık market)',
    fixed: 'Sabit harcama',
    fixedHint: 'Kira gibi her ay aynı tutar: her ay kendiliğinden eklensin',
    fixedWhere: 'yaklaşan ödemelerde görünecek. Durdurmak için Ödemeler ekranından silebilirsin',
  },
  income: {
    title: 'Gelir ekle',
    amount: 'Ne kadar geldi?',
    category: 'Nereden geldi?',
    note: 'Not (ör. Kasım maaşı)',
    fixed: 'Sabit gelir',
    fixedHint: 'Maaş gibi her ay aynı tutar: her ay kendiliğinden eklensin',
    fixedWhere: 'Ödemeler ekranındaki "Sabit gelirler" bölümünde görünecek. Oradan düzenleyip durdurabilirsin',
  },
};

export default {
  title: 'Ekle',
  mount(root, ctx, params) {
    const type = params.get('type') === 'income' ? 'income' : 'expense';
    const t = TEXT[type];
    const today = ctx.today();

    root.innerHTML = String(html`
      <header class="screen-head">
        <h1 tabindex="-1">${t.title}</h1>
      </header>

      <div class="segmented" role="group" aria-label="Kayıt türü">
        <a href="#/add" class="segmented__item" aria-pressed="${type === 'expense'}"><span aria-hidden="true">🧺</span> Harcama</a>
        <a href="#/add?type=income" class="segmented__item" aria-pressed="${type === 'income'}"><span aria-hidden="true">💰</span> Gelir</a>
      </div>

      <form class="card add-form" data-form novalidate>
        <label class="field-label" for="amount">${t.amount}</label>
        <div class="money-field money-field--xl">
          <span aria-hidden="true">₺</span>
          <input id="amount" name="amount" inputmode="decimal" autocomplete="off" placeholder="0"
                 aria-describedby="amount-hint amount-error" />
        </div>
        <p id="amount-error" class="field-error" role="alert" hidden></p>

        <label class="check fixed-toggle">
          <input type="checkbox" name="fixed" />
          <span>
            <strong><span aria-hidden="true">🔁</span> ${t.fixed}</strong>
            <span class="muted small block">${t.fixedHint}</span>
          </span>
        </label>
        <p class="note note--calm small" data-fixed-hint aria-live="polite" hidden></p>

        <details class="more">
          <summary>Not veya tarih ekle <span class="muted">(isteğe bağlı)</span></summary>
          <div class="stack">
            <label class="field-label" for="note">Not</label>
            <input id="note" name="note" class="input" maxlength="80" placeholder="${t.note}" />
            <label class="field-label" for="date">Tarih</label>
            <input id="date" name="date" type="date" class="input" value="${today}" max="${today}" />
          </div>
        </details>

        <fieldset class="categories">
          <legend class="field-label">${t.category}</legend>
          <p id="amount-hint" class="muted small">Tutarı yaz, sonra aşağıdan birine dokun. Hepsi bu.</p>
          <div class="category-grid">
            ${categoriesFor(type).map(
              (c) => html`
                <button type="button" class="category" data-category="${c.id}" style="--cat:${c.color}">
                  <span class="category__icon" aria-hidden="true">${c.icon}</span>
                  <span class="category__label">${c.label}</span>
                </button>`,
            )}
          </div>
        </fieldset>
      </form>`);

    const form = root.querySelector('[data-form]');
    const amountInput = form.amount;
    const error = root.querySelector('#amount-error');
    amountInput.focus();

    function showError(message) {
      error.textContent = message;
      error.hidden = false;
      amountInput.closest('.money-field').classList.add('money-field--error');
      amountInput.focus();
    }

    amountInput.addEventListener('input', () => {
      error.hidden = true;
      amountInput.closest('.money-field').classList.remove('money-field--error');
    });
    // Klavyedeki "Git/Enter" tuşu formu göndermesin; kategori seçimi kaydetme anıdır.
    form.addEventListener('submit', (e) => e.preventDefault());

    // Sabit harcama/gelir: tarih ayın hangi günü tekrarlanacağını belirler, gelecekteki bir gün de seçilebilir.
    const fixedInput = form.fixed;
    const hint = root.querySelector('[data-fixed-hint]');
    function updateFixed() {
      const on = fixedInput.checked;
      if (on) {
        form.date.removeAttribute('max');
        root.querySelector('details.more').open = true;
        const day = Number((form.date.value || today).slice(8));
        hint.textContent = `Her ayın ${day}. günü kendiliğinden eklenecek ve ${t.fixedWhere}. Tarihi aşağıdan değiştirebilirsin.`;
      } else {
        form.date.max = today;
      }
      hint.hidden = !on;
    }
    fixedInput.addEventListener('change', updateFixed);
    form.date.addEventListener('change', updateFixed);

    form.querySelectorAll('[data-category]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const amount = parseAmount(amountInput.value);
        if (!amountInput.value.trim()) return showError('Önce tutarı yazalım 🙂');
        if (!amount) return showError('Tutarı rakamla yazalım, ör. 450 veya 450,50');

        const categoryId = btn.dataset.category;
        if (fixedInput.checked) {
          const date = form.date.value || today;
          const day = Number(date.slice(8));
          const name = form.note.value.trim() || (categoryId === 'kira' ? 'Kira' : findCategory(type, categoryId).label);
          const payment = ctx.store.addPayment({
            name,
            kind: type === 'income' ? 'diger' : paymentKindForCategory(categoryId),
            amount,
            dayOfMonth: day,
            fixed: true,
            startMonth: monthKeyOf(date),
            categoryId,
            direction: type,
          });
          ctx.navigate('home');
          ctx.toast(`${name} ${t.fixed.toLocaleLowerCase('tr')} olarak eklendi. Her ayın ${day}. günü otomatik eklenecek.`, {
            actionLabel: 'Geri al',
            onAction: () => ctx.store.deletePayment(payment.id, { withHistory: true }),
            duration: 7000,
          });
          return;
        }
        const tx = ctx.store.addTransaction({
          type,
          amount,
          categoryId,
          note: form.note.value,
          date: form.date.value || today,
        });
        const label = findCategory(type, categoryId).label;
        ctx.navigate('home');
        ctx.toast(`${label}: ${formatMoney(amount)} kaydedildi`, {
          actionLabel: 'Geri al',
          onAction: () => ctx.store.deleteTransaction(tx.id),
        });
      }),
    );
  },
};
