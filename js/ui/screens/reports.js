// Raporlar: seçilen ayın gelen/giden özeti, kategori dağılımı ve kayıt listesi.

import { budgetMessage, gentleInsights, monthSummary, transactionsInMonth } from '../../domain/budget.js';
import { findCategory } from '../../domain/categories.js';
import { backupFileName, BackupError, createBackup, parseBackup } from '../../data/backup.js';
import { addMonths, dayLabel, daysBetween, monthKeyOf, monthLabel } from '../../domain/dates.js';
import { formatMoney } from '../../domain/money.js';
import { percentWithSuffix } from '../../domain/text.js';
import { budgetBar, emptyState } from '../components.js';
import { mountCompare } from './compare.js';
import { mountEconomy } from './economy.js';
import { html } from '../html.js';

function statBox({ icon, label, amount, tone }) {
  return html`
    <div class="stat stat--${tone}">
      <span class="stat__icon" aria-hidden="true">${icon}</span>
      <span class="stat__label">${label}</span>
      <strong class="stat__amount">${amount}</strong>
    </div>`;
}

function categoryRows(byCategory) {
  return html`
    <ul class="cat-list">
      ${byCategory.map(
        ({ category, amount, share }) => html`
          <li class="cat-row">
            <div class="cat-row__top">
              <span><span aria-hidden="true">${category.icon}</span> ${category.label}</span>
              <span><strong>${formatMoney(amount)}</strong> <span class="muted">· %${Math.round(share * 100)}</span></span>
            </div>
            <div class="cat-row__bar" aria-hidden="true">
              <div style="width:${Math.max(share * 100, 2)}%; background:${category.color}"></div>
            </div>
          </li>`,
      )}
    </ul>`;
}

function transactionList(list) {
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  return html`
    <ul class="tx-list">
      ${sorted.map((t) => {
        const c = findCategory(t.type, t.categoryId);
        const income = t.type === 'income';
        return html`
          <li class="tx">
            <span class="tx__icon" aria-hidden="true">${c.icon}</span>
            <div class="tx__body">
              <span class="tx__title">${t.note || c.label}</span>
              <span class="muted small">${dayLabel(t.date)} · ${c.label}</span>
            </div>
            <span class="tx__amount ${income ? 'tx__amount--in' : ''}">${income ? '+' : '−'}${formatMoney(t.amount)}</span>
            <button type="button" class="icon-btn" data-delete="${t.id}" aria-label="${t.note || c.label} kaydını sil">🗑️</button>
          </li>`;
      })}
    </ul>`;
}

export default {
  title: 'Raporlar',
  mount(root, ctx, params) {
    const view = ['aylar', 'ekonomi'].includes(params.get('gorunum')) ? params.get('gorunum') : 'ozet';
    root.innerHTML = String(html`
      <header class="screen-head">
        <h1 tabindex="-1">Raporlar</h1>
      </header>
      <div class="segmented segmented--3" role="group" aria-label="Rapor türü">
        <a href="#/reports" class="segmented__item" aria-pressed="${view === 'ozet'}"><span aria-hidden="true">📋</span> Aylık özet</a>
        <a href="#/reports?gorunum=aylar" class="segmented__item" aria-pressed="${view === 'aylar'}"><span aria-hidden="true">📈</span> Aylar arası</a>
        <a href="#/reports?gorunum=ekonomi" class="segmented__item" aria-pressed="${view === 'ekonomi'}"><span aria-hidden="true">🧮</span> Ev ekonomisi</a>
      </div>`);
    if (view === 'aylar') mountCompare(root, ctx);
    else if (view === 'ekonomi') mountEconomy(root, ctx);
    else mountMonth(root, ctx, params);
  },
};

function mountMonth(root, ctx, params) {
  const state = ctx.store.getState();
  const thisMonth = monthKeyOf(ctx.today());
  const requested = params.get('ay');
  const key = requested && /^\d{4}-\d{2}$/.test(requested) && requested <= thisMonth ? requested : thisMonth;
  const summary = monthSummary(state, key);
  const insights = gentleInsights(state, key);
  const list = transactionsInMonth(state.transactions, key);
  const msg = budgetMessage(summary.usedRatio);

  root.insertAdjacentHTML(
    'beforeend',
    String(html`
    <nav class="month-nav" aria-label="Ay seçimi">
      <a class="icon-btn" href="#/reports?ay=${addMonths(key, -1)}" aria-label="Önceki ay">‹</a>
      <strong aria-live="polite">${monthLabel(key)}</strong>
      ${key < thisMonth
        ? html`<a class="icon-btn" href="#/reports?ay=${addMonths(key, 1)}" aria-label="Sonraki ay">›</a>`
        : html`<span class="icon-btn icon-btn--disabled" aria-hidden="true">›</span>`}
    </nav>

    <div class="stats">
      ${statBox({ icon: '⬇️', label: 'Gelen', amount: formatMoney(summary.income), tone: 'in' })}
      ${statBox({ icon: '⬆️', label: 'Giden', amount: formatMoney(summary.expense), tone: 'out' })}
      ${statBox({
        icon: summary.balance >= 0 ? '🌿' : '🤝',
        label: summary.balance >= 0 ? 'Artan' : 'Eksik',
        amount: formatMoney(Math.abs(summary.balance)),
        tone: summary.balance >= 0 ? 'calm' : 'notice',
      })}
    </div>

    ${summary.budget
      ? html`
          <section class="card">
            <p class="summary__percent">Aylık bütçenin <strong>${percentWithSuffix(summary.usedRatio * 100)}</strong> kullanıldı</p>
            ${budgetBar(summary.usedRatio)}
            <p class="note note--${msg.tone}"><span aria-hidden="true">${msg.icon}</span> ${msg.text}</p>
          </section>`
      : ''}

    ${insights.map(
      (i) => html`
        <p class="card note note--notice">
          <span aria-hidden="true">${i.category.icon}</span> ${i.text}
          <span class="muted small block">Geçen ay ${formatMoney(i.previous)}, bu ay ${formatMoney(i.current)}</span>
        </p>`,
    )}

    <section class="card" aria-labelledby="cat-title">
      <h2 id="cat-title">Para nereye gitti?</h2>
      ${summary.byCategory.length
        ? categoryRows(summary.byCategory)
        : emptyState({ icon: '🧺', text: `${monthLabel(key)} için henüz harcama yok.` })}
    </section>

    ${list.length
      ? html`
          <section class="card" aria-labelledby="tx-title">
            <div class="card__head">
              <h2 id="tx-title">${monthLabel(key)} kayıtları</h2>
              <span class="muted small">${list.length} kayıt</span>
            </div>
            ${transactionList(list)}
          </section>`
      : ''}

    ${dataTools(state, ctx.today())}`),
  );

  root.querySelectorAll('[data-delete]').forEach((b) =>
    b.addEventListener('click', () => {
      const removed = ctx.store.deleteTransaction(b.dataset.delete);
      if (removed) {
        ctx.toast('Kayıt silindi', { actionLabel: 'Geri al', onAction: () => ctx.store.restoreTransaction(removed) });
      }
    }),
  );
  root.querySelector('[data-backup]').addEventListener('click', () => downloadBackup(ctx));
  const fileInput = root.querySelector('[data-restore-file]');
  root.querySelector('[data-restore]').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = ''; // aynı dosya tekrar seçilebilsin
    if (file) restoreBackup(ctx, file);
  });
  root.querySelector('[data-reset]').addEventListener('click', () => {
    if (confirm('Tüm harcama, gelir ve ödeme kayıtları bu cihazdan silinecek. Emin misin?')) {
      ctx.store.resetAll();
      ctx.navigate('home');
    }
  });
}

function dataTools(state, today) {
  const last = state.settings.lastBackupAt;
  const hasData = state.transactions.length > 0 || state.payments.length > 0;
  const stale = hasData && (!last || daysBetween(last, today) >= 30);
  return html`
    <details class="card more data-tools" ${stale ? 'open' : ''}>
      <summary>Verilerim</summary>
      <p class="muted small">Tüm kayıtlar yalnızca bu cihazda, bu tarayıcıda saklanıyor. Hiçbir yere gönderilmiyor.
        Telefon değişirse ya da tarayıcı verisi silinirse kaybolmasın diye ara sıra yedek almak iyi olur.</p>
      <p class="note ${stale ? 'note--notice' : ''}">
        <span aria-hidden="true">${last ? '💾' : '🗂️'}</span>
        ${last ? `Son yedek: ${dayLabel(last)}${last.slice(0, 4) === today.slice(0, 4) ? '' : ` ${last.slice(0, 4)}`}` : 'Henüz yedek alınmadı.'}
        ${stale ? ' Bir yedek alalım mı?' : ''}
      </p>
      <div class="data-tools__actions">
        <button type="button" class="btn btn--secondary btn--block" data-backup><span aria-hidden="true">⬇️</span> Yedeği indir</button>
        <button type="button" class="btn btn--ghost btn--block" data-restore><span aria-hidden="true">⬆️</span> Yedekten yükle</button>
        <input type="file" accept="application/json,.json" data-restore-file hidden />
      </div>
      <button type="button" class="btn btn--danger-ghost btn--block" data-reset>Tüm verileri sil</button>
    </details>`;
}

function downloadBackup(ctx) {
  const today = ctx.today();
  const blob = new Blob([createBackup(ctx.store.getState(), today)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: backupFileName(today) });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  ctx.store.markBackedUp(today);
  ctx.toast('Yedek indirildi. Dosyayı güvenli bir yere (e-posta, bulut) koymayı unutma.', { duration: 7000 });
}

async function restoreBackup(ctx, file) {
  let backup;
  try {
    backup = parseBackup(await file.text());
  } catch (err) {
    ctx.toast(err instanceof BackupError ? err.message : 'Dosya okunamadı.', { duration: 8000 });
    return;
  }
  const { counts, exportedAt } = backup;
  const when = exportedAt ? `${dayLabel(exportedAt)} ${exportedAt.slice(0, 4)} tarihli yedekte` : 'Yedekte';
  const ok = confirm(
    `${when} ${counts.transactions} kayıt ve ${counts.payments} düzenli ödeme var.

` +
      'Bu cihazdaki mevcut veriler yedektekilerle değiştirilecek. Devam edelim mi?',
  );
  if (!ok) return;
  const previous = ctx.store.getState();
  ctx.store.importData({ ...backup.data, settings: { ...backup.data.settings, lastBackupAt: exportedAt ?? undefined } });
  ctx.toast('Yedek yüklendi', { actionLabel: 'Geri al', onAction: () => ctx.store.importData(previous), duration: 8000 });
}
