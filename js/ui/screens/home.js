// Ana sayfa: en fazla üç şey. Ay özeti, yaklaşan ödemeler, büyük "Harcama ekle" düğmesi.

import { budgetMessage, monthSummary, upcomingPayments } from '../../domain/budget.js';
import { longDayLabel, monthKeyOf, monthLocative } from '../../domain/dates.js';
import { amountToInput, formatMoney, parseAmount } from '../../domain/money.js';
import { percentWithSuffix } from '../../domain/text.js';
import { budgetBar, emptyState, paymentRow } from '../components.js';
import { html } from '../html.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

function welcomeCard() {
  return html`
    <section class="card card--welcome" aria-labelledby="welcome-title">
      <h2 id="welcome-title">Ev defterine hoş geldin 🌿</h2>
      <p>Evin harcamalarını ve ödemelerini burada sakince takip edebilirsin. Her şey sadece bu cihazda kalır.</p>
      <form class="budget-form" data-budget-form>
        <label for="budget-input">Bir ayda eve ne kadar harcamayı düşünüyorsunuz?</label>
        <div class="money-field">
          <span aria-hidden="true">₺</span>
          <input id="budget-input" name="budget" inputmode="decimal" autocomplete="off" placeholder="ör. 30.000" />
        </div>
        <button class="btn btn--primary btn--block" type="submit">Başlayalım</button>
      </form>
      <div class="welcome__alt">
        <button class="btn btn--ghost" type="button" data-skip>Bütçesiz devam et</button>
        <button class="btn btn--ghost" type="button" data-demo>Örnek verilerle göz at</button>
      </div>
    </section>`;
}

function summaryCard(summary) {
  const msg = budgetMessage(summary.usedRatio);
  const percent = summary.usedRatio != null ? Math.round(summary.usedRatio * 100) : null;
  return html`
    <section class="card summary" aria-labelledby="summary-title">
      <h2 id="summary-title" class="summary__label">${monthLocative(summary.key)} harcanan</h2>
      <p class="summary__amount">${formatMoney(summary.expense)}</p>
      ${summary.budget
        ? html`
            ${budgetBar(summary.usedRatio)}
            <p class="summary__percent">
              Aylık bütçenin <strong>${percentWithSuffix(percent)}</strong> kullanıldı
              ${summary.remaining >= 0
                ? html`· Kalan <strong>${formatMoney(summary.remaining)}</strong>`
                : html`· <strong>${formatMoney(-summary.remaining)}</strong> fazla`}
            </p>
            <p class="note note--${msg.tone}"><span aria-hidden="true">${msg.icon}</span> ${msg.text}</p>
            <button class="link-btn" type="button" data-edit-budget>Bütçeyi değiştir (${formatMoney(summary.budget)})</button>`
        : html`
            <p class="muted">Aylık bir bütçe belirlersen ne kadarının kullanıldığını burada görürsün.</p>
            <button class="link-btn" type="button" data-edit-budget>Bütçe belirle</button>`}
      ${summary.income ? html`<p class="summary__income"><span aria-hidden="true">⬇️</span> Bu ay gelen: <strong>${formatMoney(summary.income)}</strong></p>` : ''}
    </section>`;
}

function upcomingCard(items) {
  return html`
    <section class="card" aria-labelledby="upcoming-title">
      <div class="card__head">
        <h2 id="upcoming-title">Yaklaşan ödemeler</h2>
        ${items.length ? html`<a class="link-btn" href="#/payments">Tümü</a>` : ''}
      </div>
      ${items.length
        ? html`<ul class="payment-list">${items.map((s) => paymentRow(s))}</ul>`
        : emptyState({
            icon: '📅',
            text: 'Kira, fatura, aidat gibi her ay tekrar eden ödemeleri ekleyelim mi? Tarihi gelince burada görünür.',
            action: html`<a class="btn btn--secondary" href="#/payments?new=1">Ödeme ekle</a>`,
          })}
    </section>`;
}

function openBudgetSheet(ctx) {
  const current = ctx.store.getState().settings.monthlyBudget;
  ctx.sheet.open({
    title: 'Aylık bütçe',
    body: html`
      <form class="stack" data-form>
        <label for="sheet-budget">Bir ayda eve ne kadar harcamayı düşünüyorsunuz?</label>
        <div class="money-field">
          <span aria-hidden="true">₺</span>
          <input id="sheet-budget" name="budget" inputmode="decimal" autocomplete="off"
                 value="${amountToInput(current)}" placeholder="ör. 30.000" />
        </div>
        <p class="field-error" role="alert" hidden></p>
        <button class="btn btn--primary btn--block" type="submit">Kaydet</button>
        ${current ? html`<button class="btn btn--ghost btn--block" type="button" data-clear>Bütçeyi kaldır</button>` : ''}
      </form>`,
    onMount(el, close) {
      const input = el.querySelector('input');
      input.focus();
      input.select();
      el.querySelector('[data-form]').addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = parseAmount(input.value);
        if (!amount) {
          const err = el.querySelector('.field-error');
          err.textContent = 'Tutarı rakamla yazalım, ör. 30000';
          err.hidden = false;
          return;
        }
        close();
        ctx.store.setMonthlyBudget(amount);
        ctx.toast('Bütçe kaydedildi');
      });
      el.querySelector('[data-clear]')?.addEventListener('click', () => {
        close();
        ctx.store.setMonthlyBudget(0);
      });
    },
  });
}

export default {
  title: 'Ana sayfa',
  mount(root, ctx) {
    const state = ctx.store.getState();
    const today = ctx.today();
    const isNew = !state.settings.onboarded && state.transactions.length === 0 && state.payments.length === 0;
    const summary = monthSummary(state, monthKeyOf(today));
    const upcoming = upcomingPayments(state.payments, today, 3);

    root.innerHTML = String(html`
      <header class="screen-head">
        <h1 tabindex="-1">${greeting()} 👋</h1>
        <p class="muted">${longDayLabel(today)}</p>
      </header>
      ${isNew ? welcomeCard() : html`${summaryCard(summary)}${upcomingCard(upcoming)}`}
      <a class="btn btn--primary btn--xl btn--block add-cta" href="#/add">
        <span aria-hidden="true">＋</span> Harcama ekle
      </a>`);

    root.querySelector('[data-edit-budget]')?.addEventListener('click', () => openBudgetSheet(ctx));

    root.querySelector('[data-budget-form]')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = parseAmount(e.target.budget.value);
      if (amount) ctx.store.setMonthlyBudget(amount);
      else ctx.store.finishOnboarding();
    });
    root.querySelector('[data-skip]')?.addEventListener('click', () => ctx.store.finishOnboarding());
    root.querySelector('[data-demo]')?.addEventListener('click', () => {
      ctx.store.loadDemoData(today);
      ctx.toast('Örnek veriler yüklendi. İstediğin zaman Raporlar ekranından silebilirsin.', { duration: 7000 });
    });
  },
};
