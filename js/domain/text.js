// Türkçe dil yardımcıları.

const ONES = ['', 'i', 'si', 'ü', 'ü', 'i', 'sı', 'si', 'i', 'u']; // bir, iki, üç, dört, beş, altı, yedi, sekiz, dokuz
const TENS = ['', 'u', 'si', 'u', 'ı', 'si', 'ı', 'i', 'i', 'ı']; // on, yirmi, otuz, kırk, elli, altmış, yetmiş, seksen, doksan

/** Sayının iyelik eki: 60 -> "ı" (%60'ı), 50 -> "si" (%50'si), 100 -> "ü" (%100'ü). */
export function possessiveSuffix(n) {
  const num = Math.abs(Math.round(n));
  if (num === 0) return 'ı'; // sıfır
  if (num % 10) return ONES[num % 10];
  if (num % 100) return TENS[(num % 100) / 10];
  if (num % 1000) return 'ü'; // yüz
  if (num % 1000000) return 'i'; // bin
  return 'u'; // milyon
}

/** "%60'ı" */
export function percentWithSuffix(n) {
  const p = Math.round(n);
  return `%${p}'${possessiveSuffix(p)}`;
}
