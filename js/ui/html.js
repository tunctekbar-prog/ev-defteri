// Küçük, güvenli HTML şablonu: içine konan değerler otomatik kaçışlanır (kullanıcının yazdığı
// notlar sayfayı bozamaz). İç içe html`` çağrıları ve diziler olduğu gibi eklenir.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

class SafeHtml {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

function render(value) {
  if (value == null || value === false) return '';
  if (Array.isArray(value)) return value.map(render).join('');
  if (value instanceof SafeHtml) return value.value;
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = '';
  strings.forEach((s, i) => {
    out += s + (i < values.length ? render(values[i]) : '');
  });
  return new SafeHtml(out);
}
