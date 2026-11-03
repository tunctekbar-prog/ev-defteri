// Geliştirme için küçük, bağımlılıksız statik sunucu.
// ES modülleri file:// üzerinden çalışmadığı için gerekli.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};
const PUBLIC = ['index.html', 'manifest.webmanifest', 'sw.js', `css${sep}`, `js${sep}`, `icons${sep}`];

createServer(async (req, res) => {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const rel = relative(ROOT, resolve(ROOT, `.${urlPath}`));
  if (!PUBLIC.some((p) => rel === p || rel.startsWith(p))) {
    res.writeHead(404).end('Bulunamadı');
    return;
  }
  try {
    const body = await readFile(resolve(ROOT, rel));
    res.writeHead(200, { 'Content-Type': TYPES[extname(rel)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Bulunamadı');
  }
})
  .on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`\nBütçe Dostum zaten açık görünüyor: http://localhost:${PORT}`);
      console.log('Tarayıcıda bu adresi açabilirsin. (Başka bir pencerede çalışıyor olabilir.)');
    } else {
      console.error(err);
    }
    process.exitCode = 1;
  })
  .listen(PORT, '0.0.0.0', () => {
    console.log(`\nBütçe Dostum hazır:  http://localhost:${PORT}`);
    const lan = Object.values(networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal);
    if (lan) {
      console.log(`Telefondan (aynı Wi-Fi): http://${lan.address}:${PORT}`);
      console.log('  (Not: internetsiz çalışma ve ana ekrana ekleme yalnızca localhost veya https adreste çalışır.)');
    }
  });
