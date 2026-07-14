#!/usr/bin/env node
// serve.js — small static server to open the cloned site in the browser.
//
//   node serve.js [folder] [port]
//
// Serves the folder as the web root (http://localhost:8080 by default).
// Handy for browsing the pages and pressing Ctrl+U on each one.

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || '.');
const PORT = Number(process.argv[3] || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

function resolveFile(pathname) {
  let fp = path.join(ROOT, decodeURIComponent(pathname));
  if (!fp.startsWith(ROOT)) return null;                 // anti path-traversal guard
  const candidates = [fp];
  if (!path.extname(fp)) candidates.push(path.join(fp, 'index.html'), fp + '.html');
  for (const c of candidates) {
    try { if (fs.statSync(c).isFile()) return c; } catch { /* next */ }
  }
  try {
    if (fs.statSync(fp).isDirectory()) {
      const idx = path.join(fp, 'index.html');
      if (fs.statSync(idx).isFile()) return idx;
    }
  } catch { /* */ }
  return null;
}

http.createServer((req, res) => {
  const pathname = req.url.split('?')[0];
  const file = resolveFile(pathname);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`<h1>404</h1><p>Not found: ${pathname}</p>`);
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log(`Serving site from  ${ROOT}`);
  console.log(`→  http://localhost:${PORT}`);
});
