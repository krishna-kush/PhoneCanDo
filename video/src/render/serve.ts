// The page's server: the repo's files over loopback, TypeScript stripped
// to JavaScript on the way out (the page imports mascot/ and theme/ as they
// are, no bundler), and the facts a page can't read for itself.

import { createServer, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize } from 'node:path';
import { loadFacts } from '../facts/load.ts';
import { REPO } from '../facts/repo.ts';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.ts': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.wav': 'audio/wav',
};

export type Server = { origin: string; close: () => Promise<void> };

function send(res: ServerResponse, status: number, type: string, body: string | Buffer, extra: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra });
  res.end(body);
}

/** Serves the repo on 127.0.0.1, on [port] or any free one. */
export async function serve(port = 0): Promise<Server> {
  const facts = JSON.stringify(loadFacts());
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://local').pathname);
    if (path === '/facts.json') return send(res, 200, TYPES['.json'], facts);
    const file = normalize(join(REPO, path));
    if (!file.startsWith(REPO)) return send(res, 403, 'text/plain', 'outside the repo');
    let body: Buffer;
    try {
      body = await readFile(file);
    } catch {
      return send(res, 404, 'text/plain', `no ${path}`);
    }
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    if (file.endsWith('.ts')) return send(res, 200, type, stripTypeScriptTypes(body.toString('utf8'), { mode: 'strip' }));
    // Audio seeks by range; everything else goes whole.
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (!range) return send(res, 200, type, body, { 'Accept-Ranges': 'bytes' });
    const from = range[1] ? Number(range[1]) : 0;
    const to = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
    send(res, 206, type, body.subarray(from, to + 1), { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${from}-${to}/${body.length}` });
  });
  await new Promise<void>((done) => server.listen(port, '127.0.0.1', done));
  const { port: bound } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${bound}`,
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}
