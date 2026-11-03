// Para tutarları her yerde kuruş cinsinden tam sayı olarak tutulur (kayan nokta hatası olmasın).

const formatters = new Map();
function formatter(fractionDigits) {
  if (!formatters.has(fractionDigits)) {
    formatters.set(
      fractionDigits,
      new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }),
    );
  }
  return formatters.get(fractionDigits);
}

/** 45000 -> "₺450", 45050 -> "₺450,50" */
export function formatMoney(kurus) {
  const value = Number(kurus) || 0;
  return formatter(value % 100 === 0 ? 0 : 2).format(value / 100);
}

/**
 * Kullanıcının yazdığı tutarı kuruşa çevirir. Türkçe yazımı anlar:
 * "450", "450,5", "1.250,75", "1250.75", "₺ 2.000" -> kuruş. Geçersizse null.
 */
export function parseAmount(input) {
  if (input == null) return null;
  let text = String(input).replace(/[₺\s]|TL/gi, '');
  if (!text) return null;

  if (text.includes(',')) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, ''); // "1.250" -> binlik ayıracı
  }

  if (!/^\d+(\.\d{0,2})?$/.test(text)) return null;
  const kurus = Math.round(parseFloat(text) * 100);
  return kurus > 0 ? kurus : null;
}

/** Kuruşu form alanına yazılacak hale getirir: 45050 -> "450,50" */
export function amountToInput(kurus) {
  if (!kurus) return '';
  const lira = Math.floor(kurus / 100);
  const rest = kurus % 100;
  return rest ? `${lira},${String(rest).padStart(2, '0')}` : String(lira);
}
