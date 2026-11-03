// Ödemeler: her ay tekrar eden fatura, kira, aidat, kredi kartı. Bu ayın takvimi gibi tarih sırasıyla.

import { isIncomePayment, paymentStatus } from '../../domain/budget.js';
import { PAYMENT_KINDS, PAYMENT_SUGGESTIONS, findPaymentKind } from '../../domain/categories.js';
import { dayLabel, monthKeyOf, monthLabel } from '../../domain/dates.js';
import { amountToInput, formatMoney, parseAmount } from '../../domain/money.js';
import { emptyState, paymentRow } from '../components.js';
import { html } from '../html.js';

function openPaymentForm(ctx, existing = null) {
  const p = existing ?? { name: '', kind: 'fatura', amount: 0, dayOfMonth: '' };
  ctx.sheet.open({
    title: existing ? 'Ödemeyi düzenle' : 'Yeni düzenli ödeme',
    body: html`
      <form class="stack" data-form novalidate>
        ${existing
          ? ''
          : html`
              <p class="muted small">Hızlı seç:</p>
              <div class="chips">
                ${PAYMENT_SUGGESTIONS.map(
                  (s) => html`<button type="button" class="chip-btn" data-suggest="${s.name}" data-kind="${s.kind}">${s.name}</button>`,
                )}
              </div>`}

        <label class="field-label" for="pay-name">Ödemenin adı</label>
        <input id="pay-name" name="payname" class="input" maxlength="40" value="${p.name}" placeholder="ör. Elektrik" required />

        <fieldset>
          <legend class="field-label">Ne tür bir ödeme?</legend>
          <div class="kind-grid">
            ${PAYMENT_KINDS.map(
              (k) => html`
                <label class="kind">
                  <input type="radio" name="kind" value="${k.id}" ${k.id === p.kind ? 'checked' : ''} />
                  <span><span aria-hidden="true">${k.icon}</span> ${k.label}</span>
                </label>`,
            )}
          </div>
        </fieldset>

        <label class="field-label" for="pay-day">Her ayın kaçında?</label>
        <input id="pay-day" name="day" class="input input--short" inputmode="numeric" type="number" min="1" max="31"
               value="${p.dayOfMonth}" placeholder="ör. 5" required />

        <label class="field-label" for="pay-amount">Tutar <span class="muted">(biliyorsan; her ay değişiyorsa boş bırak)</span></label>
        <div class="money-field">
          <span aria-hidden="true">₺</span>
          <input id="pay-amount" name="amount" inputmode="decimal" autocomplete="off" value="${amountToInput(p.amount)}" placeholder="Değişken" />
        </div>

        <label class="check fixed-toggle">
          <input type="checkbox" name="fixed" ${p.fixed ? 'checked' : ''} />
          <span>
            <strong><span aria-hidden="true">🔁</span> Sabit ödeme</strong>
            <span class="muted small block">Tutar her ay aynı (kira, aidat gibi): tarihi gelince kendiliğinden harcamalara eklensin, "Ödedim" demeye gerek kalmasın</span>
          </span>
        </label>

        <p class="field-error" role="alert" hidden></p>
        <button class="btn btn--primary btn--block" type="submit">Kaydet</button>
        ${existing ? html`<button class="btn btn--danger-ghost btn--block" type="button" data-delete>Bu ödemeyi sil</button>` : ''}
      </form>`,
    onMount(el, close) {
      const form = el.querySelector('[data-form]');
      const error = el.querySelector('.field-error');
      if (!existing) form.payname.focus();

      el.querySelectorAll('[data-suggest]').forEach((b) =>
        b.addEventListener('click', () => {
          form.payname.value = b.dataset.suggest;
          form.querySelector(`input[name="kind"][value="${b.dataset.kind}"]`).checked = true;
          form.day.focus();
        }),
      );

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = form.payname.value.trim();
        const day = Number(form.day.value);
        const amountText = form.amount.value.trim();
        const amount = amountText ? parseAmount(amountText) : 0;
        const fail = (msg, field) => {
          error.textContent = msg;
          error.hidden = false;
          field.focus();
        };
        if (!name) return fail('Ödemeye bir ad verelim, ör. Elektrik', form.payname);
        if (!Number.isInteger(day) || day < 1 || day > 31) return fail('Ayın kaçında olduğunu 1 ile 31 arasında yazalım', form.day);
        if (amount === null) return fail('Tutarı rakamla yazalım ya da boş bırakalım', form.amount);
        const fixed = form.fixed.checked;
        if (fixed && !amount) return fail('Sabit ödeme için her ay eklenecek tutarı yazalım', form.amount);

        const thisMonth = monthKeyOf(ctx.today());
        const data = { name, kind: form.kind.value, amount, dayOfMonth: day, fixed };
        close();
        if (existing) {
          // Sabite yeni geçen ödeme bu aydan itibaren otomatik işlenir; geçmiş aylara dokunulmaz.
          const startMonth = fixed && !existing.fixed ? thisMonth : existing.startMonth;
          ctx.store.updatePayment(existing.id, { ...data, startMonth });
          ctx.toast('Ödeme güncellendi');
        } else {
          ctx.store.addPayment({ ...data, startMonth: thisMonth });
          ctx.toast(
            fixed
              ? `${name} eklendi. Her ayın ${day}. günü otomatik olarak harcamalara eklenecek.`
              : `${name} eklendi. Tarihi yaklaşınca ana sayfada görünecek.`,
          );
        }
      });

      el.querySelector('[data-delete]')?.addEventListener('click', () => {
        if (!confirm(`"${existing.name}" ödemesini silmek istediğine emin misin? Geçmiş harcama kayıtların silinmez.`)) return;
        close();
        ctx.store.deletePayment(existing.id);
        ctx.toast('Ödeme silindi');
      });
    },
  });
}

function openPaidSheet(ctx, status) {
  const { payment, key, dueDate } = status;
  const kind = findPaymentKind(payment.kind);
  const today = ctx.today();
  ctx.sheet.open({
    title: `${payment.name} ödendi mi?`,
    body: html`
      <form class="stack" data-form novalidate>
        <label class="field-label" for="paid-amount">Ne kadar ödendi?</label>
        <div class="money-field money-field--xl">
          <span aria-hidden="true">₺</span>
          <input id="paid-amount" name="amount" inputmode="decimal" autocomplete="off" value="${amountToInput(payment.amount)}" placeholder="0" />
        </div>
        <label class="check">
          <input type="checkbox" name="addAsExpense" ${kind.addAsExpense ? 'checked' : ''} />
          <span>Bu ayın harcamalarına da ekle</span>
        </label>
        ${payment.kind === 'kredi_karti'
          ? html`<p class="muted small">Kart harcamalarını zaten tek tek girdiysen işaretleme; yoksa iki kere sayılır.</p>`
          : ''}
        <p class="field-error" role="alert" hidden></p>
        <button class="btn btn--primary btn--block" type="submit"><span aria-hidden="true">✓</span> Evet, ödendi</button>
      </form>`,
    onMount(el, close) {
      const form = el.querySelector('[data-form]');
      form.amount.focus();
      form.amount.select();
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = form.amount.value.trim();
        const amount = text ? parseAmount(text) : 0;
        const addAsExpense = form.addAsExpense.checked;
        if (amount === null || (addAsExpense && !amount)) {
          const err = el.querySelector('.field-error');
          err.textContent = 'Harcamalara eklemek için tutarı yazalım';
          err.hidden = false;
          form.amount.focus();
          return;
        }
        close();
        // Ödeme tarihi: bugün, ama bu ödemenin ayından dışarı taşmasın.
        const date = monthKeyOf(today) === key ? today : dueDate;
        ctx.store.markPaymentPaid(payment.id, key, { amount, date, addAsExpense });
        ctx.toast(`${payment.name} ödendi olarak işaretlendi`, {
          actionLabel: 'Geri al',
          onAction: () => ctx.store.unmarkPaymentPaid(payment.id, key),
        });
      });
    },
  });
}

function manualActions(s) {
  return s.state === 'paid'
    ? html`<span class="muted small">${dayLabel(s.paidInfo.date)} tarihinde ödendi</span>
           <button type="button" class="btn btn--small btn--ghost" data-unpaid="${s.payment.id}">Geri al</button>`
    : html`<button type="button" class="btn btn--small btn--primary" data-paid="${s.payment.id}">
             <span aria-hidden="true">✓</span> Ödedim
           </button>`;
}

/** Sabit gelirin adı, günü ve tutarı; durdurmak için silinir. */
function openIncomeForm(ctx, existing) {
  ctx.sheet.open({
    title: 'Sabit geliri düzenle',
    body: html`
      <form class="stack" data-form novalidate>
        <label class="field-label" for="inc-name">Gelirin adı</label>
        <input id="inc-name" name="incname" class="input" maxlength="40" value="${existing.name}" />
        <label class="field-label" for="inc-day">Her ayın kaçında?</label>
        <input id="inc-day" name="day" class="input input--short" inputmode="numeric" type="number" min="1" max="31" value="${existing.dayOfMonth}" />
        <label class="field-label" for="inc-amount">Tutar</label>
        <div class="money-field">
          <span aria-hidden="true">₺</span>
          <input id="inc-amount" name="amount" inputmode="decimal" autocomplete="off" value="${amountToInput(existing.amount)}" />
        </div>
        <p class="muted small">Değişiklik bundan sonraki aylara uygulanır; geçmiş kayıtlar aynen kalır.</p>
        <p class="field-error" role="alert" hidden></p>
        <button class="btn btn--primary btn--block" type="submit">Kaydet</button>
        <button class="btn btn--danger-ghost btn--block" type="button" data-delete>Bu geliri durdur</button>
      </form>`,
    onMount(el, close) {
      const form = el.querySelector('[data-form]');
      const error = el.querySelector('.field-error');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = form.incname.value.trim();
        const day = Number(form.day.value);
        const amount = parseAmount(form.amount.value);
        const fail = (msg, field) => {
          error.textContent = msg;
          error.hidden = false;
          field.focus();
        };
        if (!name) return fail('Gelire bir ad verelim, ör. Maaş', form.incname);
        if (!Number.isInteger(day) || day < 1 || day > 31) return fail('Ayın kaçında olduğunu 1 ile 31 arasında yazalım', form.day);
        if (!amount) return fail('Tutarı rakamla yazalım, ör. 42000', form.amount);
        close();
        ctx.store.updatePayment(existing.id, { name, dayOfMonth: day, amount });
        ctx.toast('Sabit gelir güncellendi');
      });
      el.querySelector('[data-delete]').addEventListener('click', () => {
        if (!confirm(`"${existing.name}" artık her ay eklenmesin mi? Geçmiş kayıtların silinmez.`)) return;
        close();
        ctx.store.deletePayment(existing.id);
        ctx.toast('Sabit gelir durduruldu');
      });
    },
  });
}

/** Sabit ödemeler/gelirler kendiliğinden eklenir; kullanıcı yalnızca o ayı atlayabilir ya da geri ekleyebilir. */
function fixedActions(s) {
  const where = isIncomePayment(s.payment) ? 'gelirlere' : 'harcamalara';
  if (s.state === 'paid') {
    return html`<span class="muted small">${dayLabel(s.paidInfo.date)} tarihinde ${where} eklendi</span>
      <button type="button" class="btn btn--small btn--ghost" data-skip="${s.payment.id}">Bu ay atla</button>`;
  }
  if (s.state === 'skipped') {
    return html`<span class="muted small">Bu ay ${where} eklenmedi</span>
      <button type="button" class="btn btn--small btn--ghost" data-unpaid="${s.payment.id}">Yine de ekle</button>`;
  }
  return html`<span class="muted small">${dayLabel(s.dueDate)} günü kendiliğinden eklenecek</span>`;
}

export default {
  title: 'Ödemeler',
  mount(root, ctx, params) {
    const state = ctx.store.getState();
    const today = ctx.today();
    const key = monthKeyOf(today);
    const all = state.payments
      .filter((p) => p.active !== false)
      .map((p) => paymentStatus(p, key, today))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.payment.name.localeCompare(b.payment.name, 'tr'));
    const statuses = all.filter((s) => !isIncomePayment(s.payment));
    const incomes = all.filter((s) => isIncomePayment(s.payment));
    const paidCount = statuses.filter((s) => s.state === 'paid').length;
    const unpaidTotal = statuses.filter((s) => s.state !== 'paid' && s.state !== 'skipped').reduce((sum, s) => sum + (s.payment.amount || 0), 0);

    root.innerHTML = String(html`
      <header class="screen-head">
        <h1 tabindex="-1">Ödemeler</h1>
        <p class="muted">Kira, fatura, aidat… her ay tekrar edenler</p>
      </header>

      ${statuses.length
        ? html`
            <section class="card" aria-labelledby="month-title">
              <div class="card__head">
                <h2 id="month-title">${monthLabel(key)}</h2>
                <span class="muted small">${paidCount}/${statuses.length} ödendi</span>
              </div>
              ${unpaidTotal ? html`<p class="muted small">Bu ay kalan bilinen ödemeler: <strong>${formatMoney(unpaidTotal)}</strong></p>` : ''}
              <ul class="payment-list">
                ${statuses.map((s) =>
                  paymentRow(s, {
                    actions: html`
                      <div class="payment__actions">
                        ${s.payment.fixed ? fixedActions(s) : manualActions(s)}
                        <button type="button" class="btn btn--small btn--ghost" data-edit="${s.payment.id}" aria-label="${s.payment.name} ödemesini düzenle">Düzenle</button>
                      </div>`,
                  }),
                )}
              </ul>
            </section>`
        : html`<section class="card">
            ${emptyState({
              icon: '🗓️',
              text: 'Henüz düzenli ödeme yok. Kirayı, faturaları, aidatı ekleyelim; tarihi yaklaşınca ana sayfada görünsün.',
            })}
          </section>`}

      <button type="button" class="btn btn--primary btn--xl btn--block" data-new>
        <span aria-hidden="true">＋</span> Yeni ödeme ekle
      </button>

      ${incomes.length
        ? html`
            <section class="card" aria-labelledby="income-title">
              <div class="card__head">
                <h2 id="income-title">Sabit gelirler</h2>
                <a class="link-btn" href="#/add?type=income">Ekle</a>
              </div>
              <ul class="payment-list">
                ${incomes.map((s) =>
                  paymentRow(s, {
                    actions: html`
                      <div class="payment__actions">
                        ${fixedActions(s)}
                        <button type="button" class="btn btn--small btn--ghost" data-edit-income="${s.payment.id}" aria-label="${s.payment.name} gelirini düzenle">Düzenle</button>
                      </div>`,
                  }),
                )}
              </ul>
            </section>`
        : ''}`);

    const byId = (id) => all.find((s) => s.payment.id === id);
    root.querySelectorAll('[data-edit-income]').forEach((b) =>
      b.addEventListener('click', () => openIncomeForm(ctx, byId(b.dataset.editIncome).payment)),
    );
    root.querySelector('[data-new]').addEventListener('click', () => openPaymentForm(ctx));
    root.querySelectorAll('[data-paid]').forEach((b) => b.addEventListener('click', () => openPaidSheet(ctx, byId(b.dataset.paid))));
    root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openPaymentForm(ctx, byId(b.dataset.edit).payment)));
    root.querySelectorAll('[data-unpaid]').forEach((b) =>
      b.addEventListener('click', () => {
        const s = byId(b.dataset.unpaid);
        ctx.store.unmarkPaymentPaid(s.payment.id, key);
        // Sabit ödemede "ödenmedi"ye çekmek, tarihi geldiyse yeniden eklenmesi demektir.
        ctx.toast(s.payment.fixed ? `${s.payment.name} bu ay için yeniden eklendi` : `${s.payment.name} ödenmedi olarak değiştirildi`);
      }),
    );
    root.querySelectorAll('[data-skip]').forEach((b) =>
      b.addEventListener('click', () => {
        const s = byId(b.dataset.skip);
        ctx.store.skipFixedMonth(s.payment.id, key);
        ctx.toast(`${s.payment.name} bu ay ${isIncomePayment(s.payment) ? 'gelirlerden' : 'harcamalardan'} çıkarıldı`, {
          actionLabel: 'Geri al',
          onAction: () => ctx.store.unmarkPaymentPaid(s.payment.id, key),
        });
      }),
    );

    // Ana sayfadaki "Ödeme ekle" bağlantısı formu doğrudan açar.
    if (params.get('new') === '1') {
      history.replaceState(null, '', '#/payments');
      openPaymentForm(ctx);
    }
  },
};
