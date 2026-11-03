import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function listFiles(dir) {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)],
  );
}

const swSource = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const cached = new Set([...swSource.match(/const FILES = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));

test('çevrimdışı: uygulamanın tüm dosyaları service worker önbelleğinde', () => {
  const appFiles = ['index.html', 'manifest.webmanifest', ...['css', 'js', 'icons'].flatMap(listFiles)]
    .map((f) => `./${relative('.', f).split(sep).join('/')}`);
  const missing = appFiles.filter((f) => !cached.has(f));
  assert.deepEqual(missing, [], `sw.js → FILES listesine eklenmeli: ${missing.join(', ')}`);
});

test('çevrimdışı: önbellek listesindeki her dosya gerçekten var', () => {
  const absent = [...cached].filter((f) => f !== './' && !existsSync(join(ROOT, f)));
  assert.deepEqual(absent, []);
});

test('manifest: ikonlar var ve önbellekte; 192, 512 ve maskable ikon tanımlı', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
  for (const icon of manifest.icons) {
    assert.ok(existsSync(join(ROOT, icon.src)), icon.src);
    assert.ok(cached.has(`./${icon.src}`), icon.src);
  }
  const sizes = manifest.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
});
