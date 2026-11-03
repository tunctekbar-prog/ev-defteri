// Bağımlılıksız SVG çizgi grafik. Her grafiğin yanında aynı verinin tablosu da gösterilir;
// üzerine gelince/dokununca çıkan kutu yalnızca kolaylıktır, bilgiyi saklamaz.

import { formatMoney } from '../domain/money.js';
import { html } from './html.js';

/** Seri renkleri (renk körlüğü testinden geçmiş sıra). Renk seriye bağlıdır, sırasına değil. */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const DASHES = ['', '7 4', '1.5 4'];

/**
 * Yuva numarasına göre seri görünümü. İlk 8 seri düz çizgi ve farklı renk; sonrakiler aynı renkleri
 * kesikli, sonra noktalı çizgiyle tekrar eder. Böylece her seri hem renkten hem çizgi biçiminden ayırt edilir.
 */
export function seriesStyle(slot) {
  return {
    color: SERIES_COLORS[slot % SERIES_COLORS.length],
    dash: DASHES[Math.floor(slot / SERIES_COLORS.length) % DASHES.length],
  };
}

/** Lejant ve tablolarda seriyi gösteren kısa çizgi (rengi ve çizgi biçimiyle). */
export function seriesKey({ color, dash = '' }) {
  return html`<svg class="series-key" width="20" height="8" aria-hidden="true">
    <line x1="2" y1="4" x2="18" y2="4" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${dash}" />
  </svg>`;
}

const W = 340;
const H = 210;
const M = { top: 14, right: 58, bottom: 28, left: 50 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

const compact = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Sağ uçtaki etiket boşluğa sığsın; tam adı lejantta ve tabloda. */
const shorten = (label) => (label.length > 8 ? `${label.slice(0, 7)}…` : label);

/** 0'dan başlayan, 4 adımlı "yuvarlak" eksen: 1, 2, 2.5, 5 × 10^n */
function niceScale(max) {
  if (max <= 0) return { top: 100000, step: 25000 };
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough);
  return { top: step * 4, step };
}

function geometry(labels, series) {
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const { top, step } = niceScale(max);
  const x = (i) => M.left + (labels.length === 1 ? PLOT_W / 2 : (i * PLOT_W) / (labels.length - 1));
  const y = (v) => M.top + PLOT_H - (v / top) * PLOT_H;
  return { top, step, x, y };
}

/**
 * labels: x ekseni etiketleri, titles: tooltip başlıkları (ör. "Ekim 2026"),
 * series: [{ label, color, values: [kuruş] }]
 */
export function lineChart({ id, caption, labels, titles, series }) {
  const { top, step, x, y } = geometry(labels, series);
  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);

  // Sağ uçtaki doğrudan etiketler: çakışacaklarsa hiçbirini koyma (lejant + tablo yeterli).
  const last = labels.length - 1;
  const ends = series.map((s) => y(s.values[last])).sort((a, b) => a - b);
  const endLabelsFit = ends.every((v, i) => i === 0 || v - ends[i - 1] >= 16);

  const summary = series
    .map((s) => `${s.label}: ${s.values.map((v, i) => `${titles[i]} ${formatMoney(v)}`).join(', ')}`)
    .join('. ');

  return html`
    <figure class="chart" data-chart="${id}">
      <figcaption class="chart__caption">${caption}</figcaption>
      ${series.length > 1
        ? html`<ul class="legend">
            ${series.map((s) => html`<li>${seriesKey(s)}${s.label}</li>`)}
          </ul>`
        : ''}
      <div class="chart__plot">
        <svg viewBox="0 0 ${W} ${H}" role="img" tabindex="0" aria-label="${caption}. ${summary}">
          ${ticks.map(
            (v) => html`
              <line class="chart__grid" x1="${M.left}" x2="${W - M.right}" y1="${y(v)}" y2="${y(v)}" />
              <text class="chart__tick" x="${M.left - 8}" y="${y(v)}" text-anchor="end" dominant-baseline="middle">${compact.format(v / 100)}</text>`,
          )}
          ${labels.map(
            (l, i) => html`<text class="chart__tick" x="${x(i)}" y="${H - 8}" text-anchor="middle">${l}</text>`,
          )}
          <line class="chart__crosshair" data-crosshair y1="${M.top}" y2="${M.top + PLOT_H}" x1="0" x2="0" />
          ${series.map(
            (s) => html`
              <polyline class="chart__line" points="${s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}" stroke="${s.color}" stroke-dasharray="${s.dash || ''}" />
              ${s.values.map(
                (v, i) => html`<circle class="chart__dot" data-dot="${i}" cx="${x(i)}" cy="${y(v)}" r="4" fill="${s.color}" />`,
              )}
              ${endLabelsFit
                ? html`<text class="chart__end" x="${x(last) + 10}" y="${y(s.values[last])}" dominant-baseline="middle">${shorten(s.label)}</text>`
                : ''}`,
          )}
          <rect class="chart__hit" x="${M.left - 20}" y="0" width="${PLOT_W + 40}" height="${H}" />
        </svg>
        <div class="chart__tip" role="status" hidden></div>
      </div>
    </figure>`;
}

/** Artı imleci + ipucu kutusu. Fare, dokunma ve klavye (← →) ile çalışır. */
export function attachLineChart(root, { id, labels, titles, series }) {
  const figure = root.querySelector(`[data-chart="${id}"]`);
  if (!figure) return;
  const svg = figure.querySelector('.chart__plot > svg');
  const tip = figure.querySelector('.chart__tip');
  const crosshair = figure.querySelector('[data-crosshair]');
  const { x } = geometry(labels, series);
  let active = null;

  function show(i) {
    active = i;
    crosshair.setAttribute('x1', x(i));
    crosshair.setAttribute('x2', x(i));
    crosshair.classList.add('chart__crosshair--on');
    figure.querySelectorAll('[data-dot]').forEach((d) => d.classList.toggle('chart__dot--on', Number(d.dataset.dot) === i));

    // İçerik textContent ile kurulur: kalem adları kullanıcı metnidir.
    tip.replaceChildren();
    const head = document.createElement('div');
    head.className = 'chart__tip-title';
    head.textContent = titles[i];
    tip.append(head);
    for (const s of series) {
      const row = document.createElement('div');
      row.className = 'chart__tip-row';
      const key = document.createElement('span');
      key.className = 'chart__tip-key';
      key.innerHTML = String(seriesKey(s)); // renk ve çizgi biçimi bizim sabitlerimizden gelir
      const value = document.createElement('strong');
      value.textContent = formatMoney(s.values[i]);
      const label = document.createElement('span');
      label.textContent = s.label;
      row.append(key, value, label);
      tip.append(row);
    }
    tip.hidden = false;
    const box = svg.getBoundingClientRect();
    const px = (x(i) / W) * box.width;
    const left = Math.min(Math.max(px - tip.offsetWidth / 2, 0), box.width - tip.offsetWidth);
    tip.style.left = `${left}px`;
  }

  function hide() {
    active = null;
    tip.hidden = true;
    crosshair.classList.remove('chart__crosshair--on');
    figure.querySelectorAll('.chart__dot--on').forEach((d) => d.classList.remove('chart__dot--on'));
  }

  function nearest(clientX) {
    const box = svg.getBoundingClientRect();
    const vx = ((clientX - box.left) / box.width) * W;
    let best = 0;
    labels.forEach((_, i) => {
      if (Math.abs(x(i) - vx) < Math.abs(x(best) - vx)) best = i;
    });
    return best;
  }

  const hit = svg.querySelector('.chart__hit');
  hit.addEventListener('pointermove', (e) => show(nearest(e.clientX)));
  hit.addEventListener('pointerdown', (e) => show(nearest(e.clientX)));
  hit.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') hide();
  });
  svg.addEventListener('focus', () => show(labels.length - 1));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = (active ?? labels.length - 1) + (e.key === 'ArrowRight' ? 1 : -1);
      show(Math.min(Math.max(next, 0), labels.length - 1));
    } else if (e.key === 'Escape') {
      hide();
    }
  });
}
