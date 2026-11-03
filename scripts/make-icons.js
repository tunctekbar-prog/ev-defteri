// Uygulama amblemi tek yerde tanımlı: buradan hem icons/icon.svg hem PNG'ler üretilir
// (PWA ve iPhone ana ekranı için). Bağımlılık yok. Çizimi değiştirince çalıştır:  npm run icons
//
// Amblem: kum rengi, mürekkep çizgili kare kumbara; üstte filizli yeşil pencere, ortada ₺'li bakır
// para, sağ alta düşen uzun yeşil gölge. Renkler css/styles.css'teki temayla aynı.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const PAPER = '#DCCBA6';
const SHADOW = '#5B6B48';
const INK = '#2B251E';
const SAND = '#E9D7B0';
const SAND_DARK = '#CDAE7E';
const SPECK = '#B99467';
const SAGE = '#4F6B52';
const LEAF = '#9DB88E';
const COPPER = '#B8692F';
const COPPER_DARK = '#8E4D22';
const COPPER_LIGHT = '#CB8445';

// 512'lik tuvalde, sırayla üst üste çizilir. angle: derece, şeklin merkezi etrafında.
const SHAPES = [
  // Arka plandaki kağıt lekeleri
  ...[[58, 70, 5], [440, 52, 4], [470, 150, 3], [40, 300, 4], [76, 470, 5], [30, 420, 3], [120, 40, 3]].map(
    ([cx, cy, r]) => ({ type: 'ellipse', cx, cy, rx: r, ry: r, fill: SPECK }),
  ),
  // Uzun gölge (sağ alta, 45°)
  { type: 'poly', points: [[400, 110], [720, 430], [720, 740], [410, 740], [110, 430], [400, 430]], fill: SHADOW },
  // Kutu: mürekkep çerçeve + kum dolgu
  { type: 'rect', x: 92, y: 92, w: 328, h: 344, r: 48, fill: INK },
  { type: 'rect', x: 104, y: 104, w: 304, h: 320, r: 38, fill: SAND },
  // Alt bant
  { type: 'rect', x: 104, y: 352, w: 304, h: 72, r: 38, fill: SAND_DARK },
  { type: 'rect', x: 104, y: 352, w: 304, h: 36, r: 0, fill: SAND_DARK },
  { type: 'rect', x: 98, y: 346, w: 316, h: 10, r: 5, fill: INK },
  { type: 'arc', cx: 256, cy: 452, r0: 82, r1: 90, a0: 205, a1: 335, fill: INK },
  // Kutunun üstündeki lekeler
  ...[[150, 140, 4], [372, 132, 3], [140, 300, 5], [384, 262, 4], [362, 318, 3], [180, 396, 4], [338, 404, 3]].map(
    ([cx, cy, r]) => ({ type: 'ellipse', cx, cy, rx: r, ry: r, fill: SPECK }),
  ),
  // Filizli pencere
  { type: 'ellipse', cx: 256, cy: 164, rx: 118, ry: 44, fill: INK },
  { type: 'ellipse', cx: 256, cy: 164, rx: 108, ry: 35, fill: SAGE },
  { type: 'rect', x: 252, y: 150, w: 8, h: 50, r: 4, fill: INK }, // sap
  { type: 'ellipse', cx: 228, cy: 162, rx: 26, ry: 13, angle: 25, fill: INK },
  { type: 'ellipse', cx: 228, cy: 162, rx: 21, ry: 8, angle: 25, fill: LEAF },
  { type: 'ellipse', cx: 285, cy: 152, rx: 28, ry: 14, angle: -25, fill: INK },
  { type: 'ellipse', cx: 285, cy: 152, rx: 23, ry: 9, angle: -25, fill: LEAF },
  // Para yarığı
  { type: 'rect', x: 160, y: 222, w: 192, h: 10, r: 5, fill: INK },
  // ₺'li bakır para
  { type: 'ellipse', cx: 256, cy: 290, rx: 54, ry: 54, fill: INK },
  { type: 'ellipse', cx: 256, cy: 290, rx: 46, ry: 46, fill: COPPER },
  { type: 'arc', cx: 256, cy: 290, r0: 35, r1: 39, a0: 0, a1: 360, fill: COPPER_DARK },
  { type: 'ellipse', cx: 243, cy: 274, rx: 9, ry: 5, angle: -35, fill: COPPER_LIGHT }, // parıltı
  { type: 'rect', x: 245, y: 266, w: 8, h: 46, r: 3, fill: INK }, // ₺ gövdesi
  { type: 'rect', x: 238, y: 279, w: 30, h: 6, r: 3, angle: -22, fill: INK },
  { type: 'rect', x: 238, y: 291, w: 30, h: 6, r: 3, angle: -22, fill: INK },
  { type: 'arc', cx: 253, cy: 286, r0: 19, r1: 26, a0: 0, a1: 90, fill: INK },
];

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

function center(s) {
  return s.type === 'rect' ? [s.x + s.w / 2, s.y + s.h / 2] : [s.cx, s.cy];
}

function inShape(px, py, s) {
  let x = px;
  let y = py;
  if (s.angle) {
    // Noktayı ters yönde döndür, şekli dönmemiş gibi test et
    const [cx, cy] = center(s);
    const a = (-s.angle * Math.PI) / 180;
    x = cx + (px - cx) * Math.cos(a) - (py - cy) * Math.sin(a);
    y = cy + (px - cx) * Math.sin(a) + (py - cy) * Math.cos(a);
  }
  if (s.type === 'ellipse') return ((x - s.cx) / s.rx) ** 2 + ((y - s.cy) / s.ry) ** 2 <= 1;
  if (s.type === 'rect') {
    if (x < s.x || x > s.x + s.w || y < s.y || y > s.y + s.h) return false;
    const cx = Math.min(Math.max(x, s.x + s.r), s.x + s.w - s.r);
    const cy = Math.min(Math.max(y, s.y + s.r), s.y + s.h - s.r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= s.r ** 2;
  }
  if (s.type === 'arc') {
    const d = Math.hypot(x - s.cx, y - s.cy);
    if (d < s.r0 || d > s.r1) return false;
    const deg = ((Math.atan2(y - s.cy, x - s.cx) * 180) / Math.PI + 360) % 360;
    return s.a1 - s.a0 >= 360 || (deg >= s.a0 && deg <= s.a1) || (deg + 360 >= s.a0 && deg + 360 <= s.a1);
  }
  let inside = false;
  const pts = s.points;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const BACKGROUND = { type: 'rect', x: 0, y: 0, w: 512, h: 512, r: 112 };

/** Tuval koordinatındaki rengi (veya saydamsa null) döndürür. */
function colorAt(x, y, { maskable }) {
  if (!maskable && !inShape(x, y, BACKGROUND)) return null;
  // Maskable: telefon simgeyi daireye/kareye kırpar; çizim güvenli alanda kalsın diye %80'e küçülür
  const [hx, hy] = maskable ? [256 + (x - 256) / 0.8, 256 + (y - 256) / 0.8] : [x, y];
  for (let i = SHAPES.length - 1; i >= 0; i--) if (inShape(hx, hy, SHAPES[i])) return hex(SHAPES[i].fill);
  return hex(PAPER);
}

function arcPath(s) {
  if (s.a1 - s.a0 >= 360) {
    // Tam halka: iki daireden oluşan, ortası boş yol
    const ring = (r, sweep) =>
      `M${s.cx + r} ${s.cy}A${r} ${r} 0 1 ${sweep} ${s.cx - r} ${s.cy}A${r} ${r} 0 1 ${sweep} ${s.cx + r} ${s.cy}Z`;
    return `<path d="${ring(s.r1, 1)}${ring(s.r0, 0)}" fill="${s.fill}"/>`;
  }
  const pt = (r, deg) => {
    const a = (deg * Math.PI) / 180;
    return `${+(s.cx + r * Math.cos(a)).toFixed(2)} ${+(s.cy + r * Math.sin(a)).toFixed(2)}`;
  };
  const large = s.a1 - s.a0 > 180 ? 1 : 0;
  return `<path d="M${pt(s.r1, s.a0)}A${s.r1} ${s.r1} 0 ${large} 1 ${pt(s.r1, s.a1)}L${pt(s.r0, s.a1)}A${s.r0} ${s.r0} 0 ${large} 0 ${pt(s.r0, s.a0)}Z" fill="${s.fill}"/>`;
}

function toSvg() {
  const el = (s) => {
    const rot = s.angle ? ` transform="rotate(${s.angle} ${center(s).join(' ')})"` : '';
    if (s.type === 'ellipse') return s.rx === s.ry && !s.angle
      ? `<circle cx="${s.cx}" cy="${s.cy}" r="${s.rx}" fill="${s.fill}"/>`
      : `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" fill="${s.fill}"${rot}/>`;
    if (s.type === 'rect') return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" fill="${s.fill}"${rot}/>`;
    if (s.type === 'arc') return arcPath(s);
    return `<polygon points="${s.points.map((p) => p.join(',')).join(' ')}" fill="${s.fill}"/>`;
  };
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">',
    '  <clipPath id="c"><rect width="512" height="512" rx="112"/></clipPath>',
    '  <g clip-path="url(#c)">',
    `    <rect width="512" height="512" fill="${PAPER}"/>`,
    ...SHAPES.map((s) => `    ${el(s)}`),
    '  </g>',
    '</svg>',
    '',
  ].join('\n');
}

function render(size, opts) {
  const SS = 4; // kenar yumuşatma için piksel başına 4×4 örnek
  const rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = colorAt(((px + (sx + 0.5) / SS) * 512) / size, ((py + (sy + 0.5) / SS) * 512) / size, opts);
          if (!c) continue;
          r += c[0]; g += c[1]; b += c[2]; a++;
        }
      }
      const i = (py * size + px) * 4;
      if (a) rgba.set([Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round((a * 255) / (SS * SS))], i);
    }
  }
  return encodePng(size, rgba);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8 bit, RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const OUT = new URL('../icons/', import.meta.url);
writeFileSync(new URL('icon.svg', OUT), toSvg());
console.log('icons/icon.svg');
const FILES = [
  ['icon-192.png', 192, { maskable: false }],
  ['icon-512.png', 512, { maskable: false }],
  ['icon-maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, { maskable: true }], // iPhone köşeleri kendisi yuvarlar
];
for (const [name, size, opts] of FILES) {
  writeFileSync(new URL(name, OUT), render(size, opts));
  console.log(`icons/${name} (${size}×${size})`);
}
