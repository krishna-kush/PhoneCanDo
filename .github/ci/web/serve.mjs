#!/usr/bin/env node
// Zero-dependency static server for the built site (web/dist), used by the
// smoke tests. It mimics the production host (Cloudflare static assets with
// `not_found_handling: "404-page"`, see web/wrangler.jsonc) closely enough
// for CI:
//   /x        → x, x.html or x/index.html, whichever exists first
//   /x/       → x/index.html or x.html
//   anything else → 404.html with HTTP status 404
// No redirects, no compression, no caching: CI wants the plain bytes.
//
//   node .github/ci/web/serve.mjs web/dist [port]   # prints the base URL
//   import { startServer } from './serve.mjs'       # → { url, close }

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

async function isFile(p) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

/** Map a URL pathname to a file under root, or null. Never escapes root. */
export async function resolvePath(root, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const abs = path.join(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  const candidates = rel.endsWith('/')
    ? [path.join(abs, 'index.html'), abs.replace(/[\\/]+$/, '') + '.html']
    : [abs, abs + '.html', path.join(abs, 'index.html')];
  for (const c of candidates) if (await isFile(c)) return c;
  return null;
}

export function startServer({ root, port = 0, host = '127.0.0.1' }) {
  const base = path.resolve(root);
  const server = createServer(async (req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    let file = await resolvePath(base, pathname);
    let status = 200;
    if (!file) {
      status = 404;
      file = (await isFile(path.join(base, '404.html'))) ? path.join(base, '404.html') : null;
    }
    if (!file) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
      return;
    }
    const body = await readFile(file);
    res.writeHead(status, {
      'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'content-length': body.length,
      'cache-control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const { port: actual } = server.address();
      resolve({
        url: `http://${host}:${actual}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

// CLI: serve until killed.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [root = 'web/dist', port = '0'] = process.argv.slice(2);
  const { url } = await startServer({ root, port: Number(port) });
  console.log(url);
}
