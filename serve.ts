// serve.ts — server file statis untuk game NEON BAY: SUNSET RUN.
// Node 22 stdlib saja. Root = game/ di sebelah file ini.
// PORT env (default 8080), listen 127.0.0.1.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'game');
const PORT = Number(process.env.PORT ?? 8080);
const HOST = '127.0.0.1';

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
    // Query string diabaikan saat mencari file.
    const rawPath = decodeURIComponent((req.url ?? '/').split('?')[0].split('#')[0]);
    const relPath = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
    const resolved = resolve(join(ROOT, normalize(relPath)));
    // Path traversal keluar dari game/ ditolak (403).
    if (resolved !== ROOT && !resolved.startsWith(ROOT + sep)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden\n');
      return;
    }
    const target = statSync(resolved, { throwIfNoEntry: false })?.isDirectory()
      ? join(resolved, 'index.html')
      : resolved;
    if (!existsSync(target) || !statSync(target).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found\n');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream' });
    createReadStream(target).pipe(res);
  } catch {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('500 Internal Server Error\n');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`serve.ts: http://${HOST}:${PORT}/`);
});
