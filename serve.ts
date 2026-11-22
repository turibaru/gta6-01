// serve.ts — Static HTTP server for "NEON BAY: SUNSET RUN" (gta6-01, ronde 11).
// Node standard API only (http + fs + path). No external dependencies.
// Run: node serve.ts  (port 8080, or $PORT). Serves the repo directory.
// Written with no type annotations so `node serve.ts` runs it directly
// (Node type stripping) and it stays valid TypeScript.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ts': 'text/javascript; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/game/index.html';
    const filePath = path.normalize(path.join(ROOT, pathname));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Forbidden\n');
      return;
    }
    let target = filePath;
    try {
      const info = await stat(target);
      if (info.isDirectory()) target = path.join(target, 'index.html');
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found\n');
      return;
    }
    const ext = path.extname(target).toLowerCase();
    const body = await readFile(target);
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Server error: ${err.message}\n`);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`NEON BAY server: http://127.0.0.1:${PORT}/ (root ${ROOT})`);
});
