// Loaded with --import into the data.mjs child of data.test.mjs: answers
// api.cloudflare.com from the sample rows, so no request leaves the machine.
//   STUB_TOKEN  the only bearer token accepted
//   STUB_CF     ok (default) | deny (403 everywhere) | forbid (any call throws)
import { d1Statements } from './queries.mjs';
import { sampleAe, sampleResults } from './sample.test-support.mjs';

const real = globalThis.fetch;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Analytics Engine queries, told apart by their first column.
const AE_QUERIES = {
  'blob4 AS client': 'viewClients',
  'blob2 AS ref': 'viewReferrers',
  'blob6 AS client': 'downloadClients',
  'blob4 AS android': 'downloadAndroid',
  'blob5 AS ref': 'downloadReferrers',
};

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!u.startsWith('https://api.cloudflare.com/')) return real(url, init);
  const mode = process.env.STUB_CF ?? 'ok';
  if (mode === 'forbid') throw new Error('Cloudflare must not be called');
  if (init.headers?.authorization !== `Bearer ${process.env.STUB_TOKEN}`) return json(401, { success: false, errors: [{ message: 'bad auth' }] });
  if (mode === 'deny') return json(403, { success: false, errors: [{ message: 'Authentication error' }] });
  if (u.includes('/d1/database/')) {
    // The statement order does not depend on the window, so any window names them.
    const names = d1Statements({ now: Date.now(), days: 30 }).map((s) => s.name);
    const sent = JSON.parse(init.body).sql.split(';\n');
    if (sent.length !== names.length) return json(400, { success: false, errors: [{ message: `expected ${names.length} statements, got ${sent.length}` }] });
    const rows = sampleResults();
    return json(200, { success: true, errors: [], result: names.map((n) => ({ success: true, results: rows[n] ?? [], meta: { rows_read: 10 } })) });
  }
  if (u.endsWith('/analytics_engine/sql')) {
    const name = Object.entries(AE_QUERIES).find(([column]) => String(init.body).includes(column))?.[1];
    return json(200, { meta: [], data: name ? sampleAe().results[name] : [], rows: 0 });
  }
  return json(404, { success: false, errors: [{ message: 'no such route' }] });
};
