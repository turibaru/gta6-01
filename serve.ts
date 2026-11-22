// serve.ts — server file statis untuk game NEON BAY: SUNSET RUN.
// Node 22 stdlib saja. Root = game/ di sebelah file ini.
// PORT env (default 8080), listen 127.0.0.1.
// Query string diabaikan saat cari file; path traversal keluar dari game/
// ditolak (403); 404 bila file tidak ada.
import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'game');
const PORT = Number(process.env.PORT ?? 8080);

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

const server = createServer(async (req, res) => {
  try {
    const rawPath = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
    const rel = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
    const filePath = resolve(join(ROOT, normalize(rel)));
    // Tolak path traversal keluar dari game/.
    if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('403 forbidden\n');
      return;
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404 not found\n');
      return;
    }
    const body = await readFile(filePath);
    res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('500 internal error\n');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`serve.ts: http://127.0.0.1:${PORT}/ (root ${ROOT})`);
});
