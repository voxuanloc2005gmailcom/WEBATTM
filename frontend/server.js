import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.PORT || 3000);
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(rootDir, 'public');

const contentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif']
]);

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const target = path.resolve(publicDir, relative);
  if (target === publicDir || target.startsWith(`${publicDir}${path.sep}`)) return target;
  return null;
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': contentTypes.get(ext) || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  try {
    if (req.url === '/healthz') {
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end('OK');
      return;
    }

    const target = safePath(req.url || '/');
    if (!target) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad request');
      return;
    }

    fs.stat(target, (statError, stats) => {
      if (!statError && stats.isFile()) {
        sendFile(res, target);
        return;
      }

      const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
      // Static assets must return a real 404 instead of the SPA HTML fallback.
      if (pathname.startsWith('/assets/') || pathname === '/favicon.ico' || pathname.includes('.')) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end('Not found');
        return;
      }

      // SPA fallback: application routes are rendered client-side.
      sendFile(res, path.join(publicDir, 'index.html'));
    });
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal server error');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Frontend listening on :${port}`);
});
