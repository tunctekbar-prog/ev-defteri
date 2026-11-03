// Ekranlar arasında paylaşılan küçük arayüz parçaları.

import { statusText } from '../domain/budget.js';
import { findCategory, paymentIcon } from '../domain/categories.js';
import { dayLabel } from '../domain/dates.js';
import { formatMoney } from '../domain/money.js';
import { percentWithSuffix } from '../domain/text.js';
import { html } from './html.js';

/** Bütçe ilerleme çubuğu. Durum renkle birlikte yazıyla da söylenir. */
export function budgetBar(usedRatio) {
  const percent = Math.round(usedRatio * 100);
  const over = usedRatio >= 1;
  return html`
    <div class="progress ${over ? 'progress--over' : usedRatio >= 0.8 ? 'progress--near' : ''}"
         role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(percent, 100)}"
         aria-label="Bütçenin ${percentWithSuffix(percent)} kullanıldı">
      <div class="progress__fill" style="width:${Math.min(percent, 100)}%"></div>
    </div>`;
}

const STATUS_ICONS = { paid: '✓', skipped: '⏭️', today: '⏰', soon: '⏳', upcoming: '📅', overdue: '⚠️' };

export function statusChip(status) {
  return html`<span class="chip chip--${status.state}"><span aria-hidden="true">${STATUS_ICONS[status.state]}</span> ${statusText(status)}</span>`;
}

/** Ödeme satırı (ana sayfa ve Ödemeler ekranında kullanılır). */
export function paymentRow(status, { actions = null } = {}) {
  const { payment, dueDate, paidInfo } = status;
  const amount = paidInfo?.amount || payment.amount;
  const income = payment.direction === 'income';
  return html`
    <li class="payment payment--${status.state}">
      <span class="payment__icon" aria-hidden="true">${income ? findCategory('income', payment.categoryId).icon : paymentIcon(payment)}</span>
      <div class="payment__body">
        <div class="payment__top">
          <strong class="payment__name">${payment.name}</strong>
          <span class="payment__amount">${amount ? `${income ? '+' : ''}${formatMoney(amount)}` : 'Tutar değişken'}</span>
        </div>
        ${payment.fixed ? html`<span class="tag tag--fixed"><span aria-hidden="true">🔁</span> ${income ? 'Sabit gelir' : 'Sabit ödeme'} · her ay otomatik</span>` : ''}
        <div class="payment__meta">
          <span>${dayLabel(dueDate)}</span>
          ${statusChip(status)}
        </div>
        ${actions}
      </div>
    </li>`;
}

export function emptyState({ icon, text, action = null }) {
  return html`
    <div class="empty">
      <span class="empty__icon" aria-hidden="true">${icon}</span>
      <p>${text}</p>
      ${action}
    </div>`;
}

/** Ekranın altındaki kısa bildirim; isteğe bağlı "Geri al" düğmesiyle. */
export function createToaster(el) {
  let timer = null;
  function hide() {
    el.classList.remove('toast--show');
    clearTimeout(timer);
  }
  return function toast(message, { actionLabel, onAction, duration = 5000 } = {}) {
    clearTimeout(timer);
    el.innerHTML = String(html`
      <span>${message}</span>
      ${actionLabel ? html`<button type="button" class="toast__action">${actionLabel}</button>` : ''}`);
    el.querySelector('.toast__action')?.addEventListener('click', () => {
      hide();
      onAction?.();
    });
    el.classList.add('toast--show');
    timer = setTimeout(hide, duration);
  };
}

/** Alttan açılan sayfa (native <dialog>: klavye, odak ve ekran okuyucu desteği hazır gelir). */
export function createSheet(dialog) {
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close(); // arka plana dokununca kapan
  });
  dialog.addEventListener('close', () => {
    dialog.innerHTML = '';
  });
  return {
    open({ title, body, onMount }) {
      dialog.innerHTML = String(html`
        <div class="sheet__inner">
          <div class="sheet__head">
            <h2 class="sheet__title">${title}</h2>
            <button type="button" class="icon-btn" data-close aria-label="Kapat">✕</button>
          </div>
          ${body}
        </div>`);
      const close = () => dialog.close();
      dialog.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
      dialog.showModal();
      onMount?.(dialog, close);
    },
  };
}
