// Tarihler "YYYY-MM-DD", aylar "YYYY-MM" metni olarak tutulur ve yerel saatle hesaplanır.

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

const pad = (n) => String(n).padStart(2, '0');

export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(now = new Date()) {
  return toISODate(now);
}

export function monthKeyOf(isoDate) {
  return isoDate.slice(0, 7);
}

function parseMonthKey(key) {
  const [year, month] = key.split('-').map(Number);
  return { year, month };
}

export function addMonths(key, n) {
  const { year, month } = parseMonthKey(key);
  const d = new Date(year, month - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function daysInMonth(key) {
  const { year, month } = parseMonthKey(key);
  return new Date(year, month, 0).getDate();
}

/** Ayın 31'i gibi günler kısa aylarda ayın son gününe kayar. */
export function dueDateIn(key, dayOfMonth) {
  const day = Math.min(Math.max(1, dayOfMonth), daysInMonth(key));
  return `${key}-${pad(day)}`;
}

/** b - a, gün olarak (yaz saati kaymalarından etkilenmez). */
export function daysBetween(aIso, bIso) {
  const toUTC = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUTC(bIso) - toUTC(aIso)) / 86400000);
}

export function monthName(key) {
  return MONTHS[parseMonthKey(key).month - 1];
}

/** Grafik ekseni için kısa ad: "Kas", yıl gerekiyorsa "Kas 26" */
export function monthShort(key, withYear = false) {
  const { year, month } = parseMonthKey(key);
  const short = MONTHS[month - 1].slice(0, 3);
  return withYear ? `${short} ${String(year).slice(2)}` : short;
}

/** "Kasım 2026" */
export function monthLabel(key) {
  return `${monthName(key)} ${parseMonthKey(key).year}`;
}

/** "5 Kasım" */
export function dayLabel(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "2 Kasım Pazartesi" */
export function longDayLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}`;
}

/** Ay adına bulunma eki: "Kasım'da", "Ekim'de", "Mart'ta", "Şubat'ta" */
export function monthLocative(key) {
  const name = monthName(key);
  const lastVowel = [...name.toLocaleLowerCase('tr')].reverse().find((c) => 'aıoueiöü'.includes(c));
  const back = 'aıou'.includes(lastVowel);
  const hard = /[çfhkpsşt]$/i.test(name);
  return `${name}'${hard ? 't' : 'd'}${back ? 'a' : 'e'}`;
}
