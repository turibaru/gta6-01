// serve.ts — Server HTTP statis untuk "NEON BAY: SUNSET RUN" (gta6-01, ronde 12).
// Node tanpa dependensi eksternal. Jalankan: node serve.ts
// Menyajikan direktori repo di port 8080 dengan content-type yang benar
// untuk .html/.js/.mjs/.json/.jpg/.png/.css/.svg/.ico.
// Ditulis sebagai sintaks JS murni (tanpa anotasi TS) supaya bisa dijalankan
// langsung oleh `node serve.ts` (type stripping Node 22+).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".ts": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function resolvePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const rel = decoded.replace(/^\/+/, "");
  const abs = path.normalize(path.join(ROOT, rel));
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null;
  return abs;
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
    res.end("method not allowed\n");
    return;
  }
  let file = resolvePath(req.url || "/");
  if (file === null) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("forbidden\n");
    return;
  }
  if (file === ROOT) file = path.join(ROOT, "game", "index.html");
  try {
    const stat = fs.statSync(file);
    if (stat.isDirectory()) {
      const index = path.join(file, "index.html");
      if (fs.existsSync(index)) file = index;
      else {
        res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
        res.end("forbidden\n");
        return;
      }
    }
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "content-type": type, "content-length": fs.statSync(file).size });
    if (req.method === "HEAD") { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    if (err && err.code === "ENOENT") {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("not found\n");
    } else {
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("internal error\n");
    }
  }
});

server.listen(PORT, () => {
  console.log("serve: http://localhost:" + PORT + "/  (root: " + ROOT + ")");
});

export { server };
