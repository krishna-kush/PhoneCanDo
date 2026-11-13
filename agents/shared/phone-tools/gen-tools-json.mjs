#!/usr/bin/env node
// Writes tools.json, the phone tools as the bridge's MCP endpoint serves them
// (app/docs/modules/bridge.md → MCP), from the TS definitions in this folder:
//   node agents/shared/phone-tools/gen-tools-json.mjs           write it
//   node agents/shared/phone-tools/gen-tools-json.mjs --check   exit 1 when stale
// `pnpm -C agents check` runs the check (gen-tools-json.test.mjs).
//
// MCP serves a tool by calling its one bridge route through the same router
// as the HTTP route, so we trace each tool's `run` against a stub bridge. A
// tool goes in only when every probe makes exactly one call, always to the
// same route, sends its arguments through unchanged (plus the fields it
// always adds, kept as `body`) and returns that call's text as is. A tool
// whose run composes several calls or builds on a result in TypeScript (the
// control/composed.ts wrappers) is left out: only that TypeScript can run
// it. Each one is listed under `omitted` with the reason the trace showed.
import { readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const TABLE = join(HERE, 'tools.json');
const CMD = 'node agents/shared/phone-tools/gen-tools-json.mjs';
const BRIDGE = 'http://bridge.invalid';
const PROBE = { probe: 'phonecando' };

// The tool files import siblings without an extension (the agent's bundler
// resolves them); Node needs the .ts.
let hooked = false;
function hookExtensionless() {
  if (hooked) return;
  hooked = true;
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith('.') && !extname(specifier)) {
        try {
          return next(`${specifier}.ts`, context);
        } catch {
          // Not a .ts sibling: resolve it as written.
        }
      }
      return next(specifier, context);
    },
  });
}

// Every tool, in the order the agent adapters register them.
async function loadTools() {
  hookExtensionless();
  // client.ts reads these when it loads; the stub fetch answers them.
  process.env.PHONECANDO_BRIDGE_URL = BRIDGE;
  process.env.PHONECANDO_BRIDGE_TOKEN = 'probe';
  const { basicTools } = await import(pathToFileURL(join(HERE, 'basic.ts')).href);
  const { agentTools } = await import(pathToFileURL(join(HERE, 'agents.ts')).href);
  const { keepTools } = await import(pathToFileURL(join(HERE, 'keep.ts')).href);
  const { scheduleTools } = await import(pathToFileURL(join(HERE, 'schedule.ts')).href);
  const { controlTools } = await import(pathToFileURL(join(HERE, 'control/index.ts')).href);
  return [...basicTools, ...agentTools, ...keepTools, ...scheduleTools, ...controlTools];
}

// One run against a bridge that answers the first call with PROBE and
// refuses any further one, so a composed run ends after its second call.
async function trace(tool, args) {
  const calls = [];
  const saved = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({
      method: init.method ?? 'GET',
      path: String(url).slice(BRIDGE.length),
      body: init.body === undefined ? undefined : JSON.parse(init.body),
    });
    if (calls.length > 1) throw new Error('probe: one call only');
    return new Response(JSON.stringify({ ok: true, data: PROBE }), { status: 200 });
  };
  try {
    return { args, calls, text: await tool.run(structuredClone(args)) };
  } finally {
    globalThis.fetch = saved;
  }
}

// No arguments, then every argument set twice with different values (each
// enum end, both booleans), so a dropped, renamed or rewritten one shows.
function probes(schema) {
  const props = Object.entries(schema.properties ?? {});
  const value = (key, p, i, v) => {
    if (Array.isArray(p.enum)) return p.enum[v === 0 ? 0 : p.enum.length - 1];
    if (p.type === 'boolean') return v === 0;
    if (p.type === 'number' || p.type === 'integer') return 100 * (v + 1) + i;
    if (p.type === 'object') return { probe: `${key}:${v}` };
    if (p.type === 'array') return [`${key}:${v}`];
    return `${key}:${v}`;
  };
  const set = (v) => Object.fromEntries(props.map(([key, p], i) => [key, value(key, p, i, v)]));
  return props.length ? [{}, set(0), set(1)] : [{}];
}

const canonical = (v) => JSON.stringify(v, (_k, x) =>
  x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x);

// Why a traced tool is not one route, or null when it is.
function omission(traces) {
  const longest = traces.reduce((a, b) => (b.calls.length > a.calls.length ? b : a));
  if (longest.calls.length > 1) return `its run chains ${longest.calls.map((c) => c.path).join(' → ')} in TypeScript`;
  if (traces.some((t) => t.calls.length === 0)) return 'its run can answer without a bridge call (it checks arguments in TypeScript)';
  const [first] = traces[0].calls;
  if (traces.some((t) => t.calls[0].path !== first.path || t.calls[0].method !== first.method)) {
    return 'its run picks the route from its arguments';
  }
  if (traces.some((t) => t.text !== JSON.stringify(PROBE))) return `its run builds on what ${first.path} returns in TypeScript`;
  const fixed = first.body;
  for (const t of traces.slice(1)) {
    const expected = fixed === undefined ? undefined : { ...fixed, ...t.args };
    if (canonical(t.calls[0].body) !== canonical(expected)) return `its run rewrites its arguments for ${first.path}`;
  }
  return null;
}

export async function build() {
  const tools = [];
  const omitted = [];
  for (const tool of await loadTools()) {
    const traces = [];
    for (const args of probes(tool.input)) traces.push(await trace(tool, args));
    const why = omission(traces);
    if (why) {
      omitted.push({ name: tool.name, why });
      continue;
    }
    const call = traces[0].calls[0];
    tools.push({
      name: tool.name,
      description: tool.description,
      channel: tool.channel,
      method: call.method,
      route: call.path,
      body: call.body ?? {},
      inputSchema: tool.input,
    });
  }
  return { generated: `${CMD}; do not edit`, schema: 1, tools, omitted };
}

export async function render() {
  return `${JSON.stringify(await build(), null, 2)}\n`;
}

async function main(argv) {
  const text = await render();
  if (argv.includes('--check')) {
    let current = null;
    try {
      current = readFileSync(TABLE, 'utf8');
    } catch {
      // Missing counts as stale.
    }
    if (current === text) {
      console.log('phone-tools: tools.json is up to date');
      return 0;
    }
    console.error(`phone-tools: tools.json is stale; run ${CMD}`);
    return 1;
  }
  writeFileSync(TABLE, text);
  console.log(`phone-tools: wrote ${TABLE}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(await main(process.argv.slice(2)));
}
