// Uygulama simgesi (kumbara) tek yerde tanımlı: buradan hem icons/icon.svg hem PNG'ler üretilir
// (PWA ve iPhone ana ekranı için). Bağımlılık yok. Çizimi değiştirince çalıştır:  npm run icons
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const GREEN = '#5E8B68';
const GREEN_DARK = '#3F6648';
const CREAM = '#FBF7EF';
const CLAY = '#C98B5A';
const CLAY_LIGHT = '#E0B48C';

// 512'lik tuvalde kumbara; sırayla üst üste çizilir
const SHAPES = [
  { type: 'poly', points: [[178, 214], [196, 150], [246, 196]], fill: CREAM }, // kulak
  { type: 'rect', x: 176, y: 340, w: 46, h: 76, r: 16, fill: CREAM }, // ön bacak
  { type: 'rect', x: 296, y: 340, w: 46, h: 76, r: 16, fill: CREAM }, // arka bacak
  { type: 'ellipse', cx: 256, cy: 290, rx: 146, ry: 108, fill: CREAM }, // gövde
  { type: 'rect', x: 380, y: 252, w: 48, h: 68, r: 18, fill: CREAM }, // burun
  { type: 'ellipse', cx: 404, cy: 274, rx: 6, ry: 8, fill: GREEN }, // burun delikleri
  { type: 'ellipse', cx: 404, cy: 298, rx: 6, ry: 8, fill: GREEN },
  { type: 'ellipse', cx: 336, cy: 258, rx: 11, ry: 11, fill: GREEN_DARK }, // göz
  { type: 'ellipse', cx: 256, cy: 126, rx: 40, ry: 40, fill: CLAY }, // madeni para
  { type: 'ellipse', cx: 256, cy: 126, rx: 26, ry: 26, fill: CLAY_LIGHT },
  { type: 'rect', x: 218, y: 204, w: 76, h: 14, r: 7, fill: GREEN_DARK }, // para yarığı
];

const SHIFT_X = -12; // burun sağda olduğu için çizimi biraz sola alıp ortala

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

function inShape(x, y, s) {
  if (s.type === 'ellipse') return ((x - s.cx) / s.rx) ** 2 + ((y - s.cy) / s.ry) ** 2 <= 1;
  if (s.type === 'rect') {
    if (x < s.x || x > s.x + s.w || y < s.y || y > s.y + s.h) return false;
    const cx = Math.min(Math.max(x, s.x + s.r), s.x + s.w - s.r);
    const cy = Math.min(Math.max(y, s.y + s.r), s.y + s.h - s.r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= s.r ** 2;
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

function inRoundedRect(x, y, r) {
  return inShape(x, y, { type: 'rect', x: 0, y: 0, w: 512, h: 512, r });
}

/** Tuval koordinatındaki rengi (veya saydamsa null) döndürür. */
function colorAt(x, y, { maskable }) {
  if (!maskable && !inRoundedRect(x, y, 112)) return null;
  // Maskable: telefon simgeyi daireye/kareye kırpar; çizim güvenli alanda kalsın diye %80'e küçülür
  const [hx, hy] = maskable ? [256 + (x - 256) / 0.8, 256 + (y - 256) / 0.8] : [x, y];
  for (let i = SHAPES.length - 1; i >= 0; i--) if (inShape(hx - SHIFT_X, hy, SHAPES[i])) return hex(SHAPES[i].fill);
  return hex(GREEN);
}

function toSvg() {
  const el = (s) => {
    if (s.type === 'ellipse') return s.rx === s.ry
      ? `<circle cx="${s.cx}" cy="${s.cy}" r="${s.rx}" fill="${s.fill}"/>`
      : `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" fill="${s.fill}"/>`;
    if (s.type === 'rect') return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" fill="${s.fill}"/>`;
    return `<polygon points="${s.points.map((p) => p.join(',')).join(' ')}" fill="${s.fill}"/>`;
  };
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">',
    `  <rect width="512" height="512" rx="112" fill="${GREEN}"/>`,
    `  <g transform="translate(${SHIFT_X} 0)">`,
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
