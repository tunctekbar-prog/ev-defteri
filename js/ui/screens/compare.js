// Raporlar > Aylar arası: seçilen ayların gelen/giden grafiği ve tabloları,
// isteğe bağlı olarak kalem kalem (Akbil, Pazar, Eczane…) detaylı karşılaştırma.

import { availableMonths, categoryComparison, changeBetween, itemComparison, lastMonths, monthlyTotals } from '../../domain/compare.js';
import { monthKeyOf, monthLabel, monthShort } from '../../domain/dates.js';
import { formatMoney } from '../../domain/money.js';
import { attachLineChart, lineChart, seriesKey, seriesStyle } from '../charts.js';
import { emptyState } from '../components.js';
import { html } from '../html.js';

// Detaylı karşılaştırma ilk açıldığında grafikte gösterilen kalem sayısı (en çok harcananlar).
const DEFAULT_ITEMS = 3;

// Ekran yeniden çizilince seçimler kaybolmasın diye oturum boyunca burada tutulur.
// months: null = varsayılan (geçen ay + bu ay). itemSlots: renk yuvası -> kalem id'si.
const view = { months: null, detailed: false, itemSlots: null };

const PRESETS = [
  { n: 2, label: 'Son 2 ay' },
  { n: 3, label: 'Son 3 ay' },
  { n: 6, label: 'Son 6 ay' },
];

/**
 * Değişim hücresi: ok yönü + renk. Harcamada azalış iyi (yeşil ↓), artış kırmızı ↑.
 * Gelir ve "Artan" satırlarında tersi: artış iyi. Renk tek başına anlam taşımaz: ok ve gizli yazı da var.
 */
function changeCell(change, { upIsGood = false } = {}) {
  if (change == null) return html`<td class="num muted"><span aria-hidden="true">—</span><span class="sr-only">karşılaştırılamaz</span></td>`;
  if (change === 0) return html`<td class="num muted">Aynı</td>`;
  const up = change > 0;
  const good = up === upIsGood;
  return html`<td class="num delta delta--${good ? 'good' : 'bad'}"><span aria-hidden="true">${up ? '↑' : '↓'}</span> ${formatMoney(Math.abs(change))}
    <span class="sr-only">${up ? 'arttı' : 'azaldı'}</span></td>`;
}

function comparisonTable({ caption, months, rows, firstColumn, withYear }) {
  return html`
    <div class="table-wrap" tabindex="0" role="region" aria-label="${caption}">
      <table class="data-table">
        <caption class="sr-only">${caption}</caption>
        <thead>
          <tr>
            <th scope="col">${firstColumn}</th>
            ${months.map((k) => html`<th scope="col" class="num">${monthShort(k, withYear)}</th>`)}
            ${months.length > 1 ? html`<th scope="col" class="num">Değişim</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${rows.map(
            (r) => html`
              <tr>
                <th scope="row">${r.lead ?? html`<span aria-hidden="true">${r.icon}</span> ${r.label}`}</th>
                ${r.values.map((v) => html`<td class="num">${v ? formatMoney(v) : html`<span class="muted">—</span>`}</td>`)}
                ${months.length > 1 ? changeCell(r.change, { upIsGood: r.upIsGood }) : ''}
              </tr>`,
          )}
        </tbody>
      </table>
    </div>`;
}

/** Seçili kalemlere renk yuvası ver; yuvası olan kalemin rengi başka kalem eklenip çıkınca değişmez. */
function resolveItemSlots(items) {
  const ids = new Set(items.map((i) => i.id));
  if (!view.itemSlots) {
    view.itemSlots = items.slice(0, DEFAULT_ITEMS).map((i) => i.id);
  }
  // Seçili ay aralığında artık bulunmayan kalemleri bırak
  view.itemSlots = view.itemSlots.map((id) => (id && ids.has(id) ? id : null));
  return view.itemSlots;
}

export function mountCompare(root, ctx) {
  const state = ctx.store.getState();
  const thisMonth = monthKeyOf(ctx.today());
  const available = availableMonths(state, ctx.today());
  const months = (view.months ?? lastMonths(thisMonth, 2)).filter((k) => available.includes(k)).sort();
  const withYear = new Set(months.map((k) => k.slice(0, 4))).size > 1;
  const titles = months.map(monthLabel);
  const labels = months.map((k) => monthShort(k, withYear));

  const totals = monthlyTotals(state, months);
  const totalsChart = {
    id: 'totals',
    caption: 'Aylara göre gelen ve giden',
    labels,
    titles,
    series: [
      { label: 'Gelen', ...seriesStyle(0), values: totals.map((t) => t.income) },
      { label: 'Giden', ...seriesStyle(1), values: totals.map((t) => t.expense) },
    ],
  };

  const categories = categoryComparison(state, months);
  const items = view.detailed ? itemComparison(state, months) : [];
  const slots = view.detailed ? resolveItemSlots(items) : [];
  const chosen = slots
    .map((id, slot) => ({ item: items.find((i) => i.id === id), style: seriesStyle(slot) }))
    .filter((c) => c.item);
  const itemsChart = {
    id: 'items',
    caption: 'Seçili kalemlerin aylara göre tutarı',
    labels,
    titles,
    series: chosen.map((c) => ({ label: c.item.label, ...c.style, values: c.item.values })),
  };
  const enoughMonths = months.length >= 2;
  const presetActive = (n) => months.join() === lastMonths(thisMonth, n).filter((k) => available.includes(k)).join();

  root.insertAdjacentHTML(
    'beforeend',
    String(html`
      <section class="card" aria-labelledby="pick-title">
        <h2 id="pick-title">Hangi aylar?</h2>
        <div class="chips" role="group" aria-label="Hazır seçimler">
          ${PRESETS.map(
            (p) => html`<button type="button" class="chip-btn" data-preset="${p.n}" aria-pressed="${presetActive(p.n)}">${p.label}</button>`,
          )}
        </div>
        <div class="month-picker" role="group" aria-label="Ayları tek tek seç">
          ${[...available].reverse().map(
            (k) => html`
              <label class="month-pick">
                <input type="checkbox" data-month="${k}" ${months.includes(k) ? 'checked' : ''} />
                <span>${monthShort(k, true)}</span>
              </label>`,
          )}
        </div>
        ${enoughMonths ? '' : html`<p class="note note--notice">Karşılaştırmak için en az iki ay seçelim.</p>`}
      </section>

      ${enoughMonths
        ? html`
            <section class="card" aria-labelledby="totals-title">
              <h2 id="totals-title">Gelen ve giden</h2>
              ${lineChart(totalsChart)}
              ${comparisonTable({
                caption: 'Aylara göre gelen, giden ve artan',
                months,
                withYear,
                firstColumn: '',
                rows: [
                  { lead: html`${seriesKey(seriesStyle(0))} Gelen`, upIsGood: true, ...totalRow(totals, 'income') },
                  { lead: html`${seriesKey(seriesStyle(1))} Giden`, ...totalRow(totals, 'expense') },
                  { lead: 'Artan', upIsGood: true, ...totalRow(totals, 'balance') },
                ],
              })}
            </section>

            <section class="card" aria-labelledby="cats-title">
              <h2 id="cats-title">Kategorilere göre giden</h2>
              ${categories.length
                ? comparisonTable({ caption: 'Kategorilere göre aylık harcama', months, withYear, firstColumn: 'Kategori', rows: categories })
                : emptyState({ icon: '🧺', text: 'Seçili aylarda harcama yok.' })}
            </section>

            ${view.detailed
              ? html`
                  <section class="card" aria-labelledby="items-title">
                    <div class="card__head">
                      <h2 id="items-title">Detaylı karşılaştırma</h2>
                      <span>
                        <button type="button" class="link-btn" data-items-reset>İlk ${DEFAULT_ITEMS}'e dön</button>
                        <button type="button" class="link-btn" data-detailed="off">Kapat</button>
                      </span>
                    </div>
                    <p class="muted small">Aynı notla girilen harcamalar bir kalem sayılır (ör. her "Akbil" bir arada). İlk açılışta en çok harcanan ${DEFAULT_ITEMS} kalem gösterilir; istediğin kadar kalemi kutusuna dokunarak ekleyebilirsin.</p>
                    ${chosen.length
                      ? lineChart(itemsChart)
                      : html`<p class="note note--calm">Grafikte görmek istediğin kalemleri aşağıdan işaretle.</p>`}
                    ${items.length
                      ? itemsTable({ items, months, withYear, slots })
                      : emptyState({ icon: '📝', text: 'Seçili aylarda kalem yok.' })}
                  </section>`
              : html`
                  <button type="button" class="btn btn--secondary btn--block" data-detailed="on">
                    <span aria-hidden="true">🔍</span> Detaylı karşılaştır (Akbil, Pazar, Eczane…)
                  </button>`}`
        : ''}`),
  );

  if (enoughMonths) {
    attachLineChart(root, totalsChart);
    if (chosen.length) attachLineChart(root, itemsChart);
  }

  // --- Etkileşimler ---
  // Yeniden çizdikten sonra odağı aynı kontrole geri ver (klavye ve ekran okuyucu kullananlar yerini kaybetmesin).
  const rerender = () => {
    const el = document.activeElement;
    const attr = ['data-month', 'data-item', 'data-preset'].find((a) => el?.hasAttribute?.(a));
    const selector = attr ? `[${attr}="${CSS.escape(el.getAttribute(attr))}"]` : null;
    ctx.rerender();
    if (selector) root.querySelector(selector)?.focus({ preventScroll: true });
  };
  root.querySelectorAll('[data-preset]').forEach((b) =>
    b.addEventListener('click', () => {
      view.months = lastMonths(thisMonth, Number(b.dataset.preset));
      rerender();
    }),
  );
  root.querySelectorAll('[data-month]').forEach((input) =>
    input.addEventListener('change', () => {
      const set = new Set(months);
      if (input.checked) set.add(input.dataset.month);
      else set.delete(input.dataset.month);
      view.months = [...set].sort();
      rerender();
    }),
  );
  root.querySelectorAll('[data-detailed]').forEach((b) =>
    b.addEventListener('click', () => {
      view.detailed = b.dataset.detailed === 'on';
      rerender();
      if (view.detailed) root.querySelector('#items-title')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }),
  );
  root.querySelector('[data-items-reset]')?.addEventListener('click', () => {
    view.itemSlots = null;
    rerender();
  });
  root.querySelectorAll('[data-item]').forEach((input) =>
    input.addEventListener('change', () => {
      const id = input.dataset.item;
      if (input.checked) {
        const free = view.itemSlots.indexOf(null);
        if (free !== -1) view.itemSlots[free] = id;
        else view.itemSlots.push(id);
      } else {
        view.itemSlots = view.itemSlots.map((s) => (s === id ? null : s));
      }
      rerender();
    }),
  );
}

function totalRow(totals, field) {
  const values = totals.map((t) => t[field]);
  return { values, change: changeBetween(values) };
}

function itemsTable({ items, months, withYear, slots }) {
  return html`
    <div class="table-wrap" tabindex="0" role="region" aria-label="Kalemlere göre aylık harcama">
      <table class="data-table">
        <thead>
          <tr>
            <th scope="col">Kalem</th>
            ${months.map((k) => html`<th scope="col" class="num">${monthShort(k, withYear)}</th>`)}
            <th scope="col" class="num">Değişim</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => {
            const slot = slots.indexOf(item.id);
            const on = slot !== -1;
            return html`
              <tr>
                <th scope="row">
                  <label class="item-pick">
                    <input type="checkbox" data-item="${item.id}" ${on ? 'checked' : ''}
                           aria-label="${item.label} grafikte göster" />
                    <span><span aria-hidden="true">${item.icon}</span> ${item.label}</span>
                  </label>
                  <span class="muted small item-meta">${on ? seriesKey(seriesStyle(slot)) : ''}${item.count} kez</span>
                </th>
                ${item.values.map((v) => html`<td class="num">${v ? formatMoney(v) : html`<span class="muted">—</span>`}</td>`)}
                ${changeCell(item.change)}
              </tr>`;
          })}
        </tbody>
      </table>
    </div>`;
}
