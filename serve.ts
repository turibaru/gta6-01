// serve.ts — Server HTTP statis untuk "NEON BAY: SUNSET RUN" (gta6-01, ronde 10).
// Node tanpa dependensi eksternal. Jalankan via: node serve.ts
// Menyajikan direktori repo di port 8080 dengan content-type yang benar.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT: number = 8080;
const ROOT: string = path.dirname(fileURLToPath(import.meta.url));

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.css': 'text/css; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

function contentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

function sendFile(res: http.ServerResponse, filePath: string): void {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found\n');
      return;
    }
    res.writeHead(200, {
      'content-type': contentType(filePath),
      'content-length': data.length,
      'cache-control': 'no-cache',
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/game/index.html';
    const filePath = path.normalize(path.join(ROOT, pathname));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden\n');
      return;
    }
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found\n');
        return;
      }
      if (req.method === 'HEAD') {
        res.writeHead(200, {
          'content-type': contentType(filePath),
          'content-length': stat.size,
          'cache-control': 'no-cache',
        });
        res.end();
        return;
      }
      sendFile(res, filePath);
    });
  } catch (_e) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('400 Bad Request\n');
  }
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error('serve.ts: port ' + PORT + ' sudah dipakai — matikan server lama dulu.');
  } else {
    console.error('serve.ts error:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('NEON BAY serve.ts jalan di http://127.0.0.1:' + PORT + '/ (root: ' + ROOT + ')');
});
