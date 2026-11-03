// icons/icon.svg'deki ev çizimini bağımlılıksız PNG'lere çevirir (PWA ve iPhone ana ekranı için).
// Çizim değişirse buradaki şekli de güncelleyip çalıştır:  npm run icons
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const GREEN = [0x5e, 0x8b, 0x68];
const CREAM = [0xfb, 0xf7, 0xef];
const CLAY = [0xc9, 0x8b, 0x5a];

// 512'lik tuvalde ev (icon.svg ile aynı ölçüler)
const HOUSE = [[256, 120], [400, 236], [400, 416], [288, 416], [288, 316], [224, 316], [224, 416], [112, 416], [112, 236]];

function inPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inHouse(x, y) {
  if (!inPolygon(x, y, HOUSE)) return false;
  // Alt köşeler 24 px yuvarlak
  for (const [cx, cy] of [[136, 392], [376, 392]]) {
    const outside = (cx < 256 ? x < cx : x > cx) && y > cy;
    if (outside && (x - cx) ** 2 + (y - cy) ** 2 > 24 ** 2) return false;
  }
  return true;
}

function inRoundedRect(x, y, r) {
  const cx = Math.min(Math.max(x, r), 512 - r);
  const cy = Math.min(Math.max(y, r), 512 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** Tuval koordinatındaki rengi (veya saydamsa null) döndürür. */
function colorAt(x, y, { maskable }) {
  if (!maskable && !inRoundedRect(x, y, 112)) return null;
  // Maskable: telefon simgeyi daireye/kareye kırpar; ev güvenli alanda kalsın diye %80'e küçülür
  const [hx, hy] = maskable ? [256 + (x - 256) / 0.8, 256 + (y - 256) / 0.8] : [x, y];
  if ((hx - 256) ** 2 + (hy - 250) ** 2 <= 30 ** 2) return CLAY;
  if (inHouse(hx, hy)) return CREAM;
  return GREEN;
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
