// NEON BAY: SUNSET RUN — serve.ts (server file statis untuk dev/playtest)
// Node 22 stdlib saja. Root = game/ di sebelah file ini.
//   PORT=8080 node serve.ts   ->  http://127.0.0.1:8080/
// Ditulis fresh di sesi terekam ronde 6, dari design spec §12.

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const port = Number(process.env.PORT || 8080);

const MIME = {
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
    // Query string diabaikan saat mencari file.
    const rawPath = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
    const rel = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
    const filePath = resolve(join(root, rel));
    // Path traversal keluar dari game/ ditolak (403).
    if (filePath !== root && !filePath.startsWith(root + '/')) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('403 forbidden\n');
      return;
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404 not found\n');
      return;
    }
    const ext = extname(filePath).toLowerCase();
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    res.end(readFileSync(filePath));
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`500 ${err.message}\n`);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`serve.ts: http://127.0.0.1:${port}/  (root: ${root})`);
});
