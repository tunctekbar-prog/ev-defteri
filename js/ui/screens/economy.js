// Raporlar > Ev ekonomisi: her kartta tek bir büyük rakam, tek cümle açıklama.
// Hesabın ayrıntısı isteyene "Nasıl hesaplandı?" altında.

import { paymentIcon } from '../../domain/categories.js';
import { monthLocative, monthKeyOf } from '../../domain/dates.js';
import {
  dailyAllowance,
  lastFullMonth,
  monthEndForecast,
  needsWantsSavings,
  savingsRate,
  yearlyCosts,
} from '../../domain/economy.js';
import { formatMoney } from '../../domain/money.js';
import { percentWithSuffix } from '../../domain/text.js';
import { seriesStyle } from '../charts.js';
import { html } from '../html.js';

const pct = (ratio) => `%${Math.round(ratio * 100)}`;

/** İnce bölünmüş çubuk: yazısız; rakamlar hemen altındaki satırlarda. */
function thinBar(parts, total, label) {
  const visible = parts.filter((p) => p.amount > 0);
  return html`
    <div class="thin-bar" role="img" aria-label="${label}: ${visible.map((p) => `${p.label} ${formatMoney(p.amount)}`).join(', ')}">
      ${visible.map((p) => html`<span style="width:${(p.amount / total) * 100}%; background:${p.color}"></span>`)}
    </div>`;
}

function howCalculated(body) {
  return html`
    <details class="more how">
      <summary>Nasıl hesaplandı?</summary>
      <div class="muted small stack">${body}</div>
    </details>`;
}

function card({ id, icon, title, body }) {
  return html`
    <section class="card eco" aria-labelledby="${id}">
      <h2 id="${id}"><span aria-hidden="true">${icon}</span> ${title}</h2>
      ${body}
    </section>`;
}

function allowanceCard(a) {
  if (!a) {
    return card({
      id: 'eco-daily',
      icon: '⛽',
      title: 'Bugün ne kadar harcayabilirim?',
      body: html`<p class="muted">Aylık bütçe belirlersen, her gün rahatça ne kadar harcayabileceğini burada görürsün.</p>
        <a class="btn btn--secondary" href="#/home">Bütçe belirle</a>`,
    });
  }
  const gauge = [
    { label: 'Harcanan', amount: a.spent, ...seriesStyle(0) },
    { label: 'Yaklaşan ödemelere ayrılan', amount: a.upcoming, ...seriesStyle(1) },
  ];
  return card({
    id: 'eco-daily',
    icon: '⛽',
    title: 'Bugün ne kadar harcayabilirim?',
    body: html`
      ${a.perDay > 0
        ? html`<p class="eco__hero">${formatMoney(a.perDay)} <span class="eco__unit">/ gün</span></p>
            <p>Ayın bitmesine <strong>${a.daysLeft} gün</strong> var. Günde bu kadar harcarsan bütçe ay sonuna yeter.</p>`
        : html`<p class="eco__hero">${formatMoney(Math.abs(a.remaining))} <span class="eco__unit">eksik</span></p>
            <p class="note note--notice">Yaklaşan ödemelerle birlikte bu ayın bütçesi doldu. Zorunlu olmayan harcamaları biraz erteleyebiliriz.</p>`}
      ${thinBar(gauge, Math.max(a.budget, a.spent + a.upcoming), 'Bütçe göstergesi')}
      <ul class="eco-rows">
        ${gauge.map((g) => html`<li><span class="swatch" style="background:${g.color}"></span>${g.label}<strong>${formatMoney(g.amount)}</strong></li>`)}
        <li><span class="swatch swatch--track"></span>Kalan<strong>${formatMoney(Math.max(0, a.remaining))}</strong></li>
      </ul>
      ${howCalculated(html`
        <p>Bütçe ${formatMoney(a.budget)} − harcanan ${formatMoney(a.spent)} − bu ay henüz ödenmemiş bilinen ödemeler ${formatMoney(a.upcoming)} = ${formatMoney(a.remaining)}.</p>
        <p>Bu tutar, bugün dahil kalan ${a.daysLeft} güne bölündü. Kredi kartı ödemesi ayrılmaz, çünkü kart harcamaları zaten tek tek giriliyor.</p>`)}`,
  });
}

function forecastCard(f, today) {
  if (!f) {
    return card({
      id: 'eco-forecast',
      icon: '🔭',
      title: 'Ay sonu tahmini',
      body: html`<p class="muted">Birkaç harcama girdikten sonra ay sonunda toplam ne kadar harcamış olacağınızı tahmin edebiliriz.</p>`,
    });
  }
  const diff = f.budget ? f.budget - f.forecast : null;
  return card({
    id: 'eco-forecast',
    icon: '🔭',
    title: 'Ay sonu tahmini',
    body: html`
      <p class="eco__hero">${formatMoney(f.forecast)}</p>
      <p>${f.basedOn === 'last' ? 'Geçen ayın temposuyla giderse' : 'Bu hızla giderse'} ${monthLocative(monthKeyOf(today))} toplam bu kadar harcanmış olur.</p>
      ${diff === null
        ? ''
        : diff >= 0
          ? html`<p class="note note--calm"><span aria-hidden="true">🌿</span> Bütçenin ${formatMoney(diff)} altında kalır.</p>`
          : html`<p class="note note--notice"><span aria-hidden="true">🤝</span> Bütçeyi ${formatMoney(-diff)} aşabilir. Günlük harcamayı biraz azaltmak yetebilir.</p>`}
      ${howCalculated(html`
        <p>Şimdiye kadar harcanan ${formatMoney(f.spent)}
          + günlük harcamalar (market, ulaşım…) günde ortalama ${formatMoney(f.pace)} × kalan ${f.daysLeft} gün
          + yaklaşan bilinen ödemeler ${formatMoney(f.upcoming)}.</p>
        ${f.basedOn === 'last' ? html`<p>Ayın ilk haftasında veri az olduğu için günlük tempo geçen aydan alındı.</p>` : ''}`)}`,
  });
}

function savingsCard(s) {
  const title = 'Gelirin ne kadarı cepte kaldı?';
  if (!s) {
    return card({ id: 'eco-savings', icon: '🐷', title, body: html`<p class="muted">Gelirlerinizi girdikçe, her ay gelirin ne kadarının cepte kaldığını burada görürsünüz.</p>` });
  }
  const m = s.month;
  return card({
    id: 'eco-savings',
    icon: '🐷',
    title,
    body: html`
      ${m
        ? m.saved >= 0
          ? html`<p class="eco__hero">${pct(m.rate)}</p>
              <p>${monthLocative(m.key)} gelirin <strong>${percentWithSuffix(m.rate * 100)}</strong> cepte kaldı (${formatMoney(m.saved)}).</p>`
          : html`<p class="eco__hero">${formatMoney(-m.saved)} <span class="eco__unit">eksik</span></p>
              <p class="note note--notice">${monthLocative(m.key)} gider gelirden biraz fazla oldu. Bir göz atalım mı?</p>`
        : ''}
      ${s.months > 1 ? html`<p class="muted">Son ${s.months} ayın ortalaması: <strong>${pct(s.average)}</strong></p>` : ''}
      ${howCalculated(html`<p>(Gelir − gider) ÷ gelir. Bu ay henüz bitmediği için son tamamlanan ay gösteriliyor.</p>`)}`,
  });
}

function splitCard(split) {
  const title = 'Gelir nasıl bölündü? (50/30/20)';
  if (!split) {
    return card({ id: 'eco-split', icon: '🧺', title, body: html`<p class="muted">Geçen ayın gelirini girdiğinizde, gelirin nasıl bölündüğünü burada görürsünüz.</p>` });
  }
  const parts = split.parts.map((p, i) => ({ ...p, ...seriesStyle(i) }));
  const saved = parts[2];
  return card({
    id: 'eco-split',
    icon: '🧺',
    title,
    body: html`
      <p class="muted small">${monthLocative(split.key)} gelir: ${formatMoney(split.income)}</p>
      ${thinBar(parts, Math.max(split.income, parts[0].amount + parts[1].amount), 'Gelirin bölünüşü')}
      <ul class="eco-rows eco-rows--split">
        ${parts.map(
          (p) => html`
            <li>
              <span class="swatch" style="background:${p.color}"></span>
              <span>${p.label} <span class="muted small block">${p.hint}</span></span>
              <span class="eco-rows__value"><strong>${pct(p.share)}</strong><span class="muted small block">önerilen ${pct(p.target)}</span></span>
            </li>`,
        )}
      </ul>
      ${saved.share >= 0.2
        ? html`<p class="note note--calm"><span aria-hidden="true">🌿</span> Önerilen tasarruf oranını yakalamışsınız.</p>`
        : html`<p class="note note--notice"><span aria-hidden="true">🎯</span> Hedef, gelirin %20'sinin cepte kalması. Şu an ${pct(Math.max(0, saved.share))}.</p>`}
      ${howCalculated(html`
        <p>Yaygın bir kural: gelirin yaklaşık %50'si zorunlu giderlere, %30'u isteğe bağlı harcamalara gitsin, %20'si cepte kalsın.</p>
        <p>Her aile farklıdır; bu sadece kıyaslamak için bir ölçü. Kira yüksekse zorunlu payın büyük çıkması normaldir.</p>`)}`,
  });
}

function yearlyCard(y) {
  const title = 'Düzenli ödemeler yılda ne ediyor?';
  if (!y.rows.length) {
    return card({
      id: 'eco-yearly',
      icon: '📆',
      title,
      body: html`<p class="muted">Kira, fatura, abonelik gibi düzenli ödemeleri eklediğinizde yıllık toplamlarını burada görürsünüz.</p>
        <a class="btn btn--secondary" href="#/payments?new=1">Ödeme ekle</a>`,
    });
  }
  return card({
    id: 'eco-yearly',
    icon: '📆',
    title,
    body: html`
      <p class="eco__hero">${formatMoney(y.total)} <span class="eco__unit">/ yıl</span></p>
      <p>Aylık küçük görünen ödemeler, yılda toplam bu kadar ediyor.</p>
      <ul class="eco-rows eco-rows--yearly">
        ${y.rows.map(
          (r) => html`
            <li>
              <span class="eco-rows__icon" aria-hidden="true">${paymentIcon(r.payment)}</span>
              <span>${r.payment.name}
                <span class="muted small block">${r.noData
                  ? 'henüz kayıt yok'
                  : r.estimated
                    ? `ortalama ${formatMoney(r.monthly)} / ay`
                    : `${formatMoney(r.monthly)} / ay`}</span>
              </span>
              <strong>${r.noData ? '—' : formatMoney(r.yearly)}</strong>
            </li>`,
        )}
      </ul>
      ${y.billsLast12 ? html`<p class="muted small">Faturalara son 12 ayda ödenen toplam: <strong>${formatMoney(y.billsLast12)}</strong></p>` : ''}
      ${howCalculated(html`
        <p>Tutarı her ay aynı olan ödemeler: aylık tutar × 12.</p>
        <p>Tutarı değişenler (elektrik, doğalgaz…): son 12 ayda aynı adla girilen ödemelerin aylık ortalaması × 12, yani bir tahmin.</p>`)}`,
  });
}

export function mountEconomy(root, ctx) {
  const state = ctx.store.getState();
  const today = ctx.today();
  root.insertAdjacentHTML(
    'beforeend',
    String(html`
      <p class="muted eco-intro">Evin ekonomisine biraz daha yakından bakalım. Rakamlar sadece yol gösterir.</p>
      ${allowanceCard(dailyAllowance(state, today))}
      ${forecastCard(monthEndForecast(state, today), today)}
      ${savingsCard(savingsRate(state, today))}
      ${splitCard(needsWantsSavings(state, lastFullMonth(today)))}
      ${yearlyCard(yearlyCosts(state, today))}`),
  );
}
