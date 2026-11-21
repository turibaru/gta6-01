// serve.ts — server file statis untuk playtest lokal NEON BAY 3D.
// Node 22 stdlib only, tanpa dependensi eksternal.
//
//   node serve.ts
//   -> http://localhost:8080/  (game), http://localhost:8080/?shot=cover (preset)
//
// Melayani direktori game/ di sebelah file ini. Query string (?shot=...)
// diabaikan saat mencari file; path traversal keluar dari game/ ditolak.

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), 'game');
const PORT = Number(process.env.PORT || 8080);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const file = resolve(join(root, normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '')));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('forbidden');
      return;
    }
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream';
    const body = readFileSync(file);
    res.writeHead(200, { 'content-type': type, 'content-length': body.length });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(`server error: ${(err as Error).message}`);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`NEON BAY 3D: http://localhost:${PORT}/  (root: ${root})`);
});
