// The engine block: its style, launch command, auth (server), readiness and
// resume args. A server engine is ready once its readiness path answers; a
// tui engine (the agent's own TUI in a PTY) after its first output and some
// quiet, or after being alive a while, with defaults for both.
import { fields, integer, isObject, list, oneOf, string, type Add, type Json } from './primitives.ts';
import { ENGINE_STYLES, MAX, PATTERNS, READINESS_RULES } from './rules.ts';
import { command, httpBlock, template } from './templates.ts';

const ENGINE_FIELDS = ['style', 'launch', 'auth', 'readiness', 'resume'];

export function checkEngine(add: Add, engine: unknown) {
  // acp is named as reserved, not as an unknown field.
  if (!fields(add, '/engine', engine, [...ENGINE_FIELDS, 'acp'], ['style', 'launch'])) return;
  const e = engine as Json;
  if ('acp' in e) add('/engine/acp', 'reserved', 'the acp engine style is reserved and not in v1');
  if (e.style === 'acp') add('/engine/style', 'reserved', 'the acp engine style is reserved and not in v1');
  else oneOf(add, '/engine/style', e.style, ENGINE_STYLES);
  if ('launch' in e) {
    const launch = command(add, '/engine/launch', e.launch, ['cwd']);
    if (launch && 'cwd' in launch) template(add, '/engine/launch/cwd', launch.cwd);
  }
  if ('auth' in e) checkAuth(add, e.auth, e.style === 'server');
  if ('readiness' in e) checkReadiness(add, e.readiness, e.style);
  else if (e.style === 'server') add('/engine/readiness', 'required', 'a server engine needs readiness');
  if ('resume' in e) checkResume(add, e.resume);
}

function checkAuth(add: Add, auth: unknown, server: boolean) {
  if (!server) add('/engine/auth', 'forbidden', 'engine.auth is for a server engine');
  if (!fields(add, '/engine/auth', auth, ['basic'], ['basic'])) return;
  const basic = (auth as Json).basic;
  if (fields(add, '/engine/auth/basic', basic, ['user'], ['user'])) {
    string(add, '/engine/auth/basic/user', (basic as Json).user, PATTERNS.basicUser, MAX.text);
  }
}

// Exactly one rule: http for a server engine, output or alive for a tui one.
function checkReadiness(add: Add, readiness: unknown, style: unknown) {
  const at = '/engine/readiness';
  if (!fields(add, at, readiness, READINESS_RULES, [])) return;
  const r = readiness as Json;
  const rules = READINESS_RULES.filter((key) => key in r);
  if (rules.length === 0) add(at, 'required', `readiness names one of ${READINESS_RULES.join(', ')}`);
  for (const extra of rules.slice(1)) add(`${at}/${extra}`, 'forbidden', `one readiness rule only (${rules[0]} is set)`);
  if ('http' in r) {
    if (style === 'tui') add(`${at}/http`, 'forbidden', 'readiness.http is for a server engine');
    httpBlock(add, `${at}/http`, r.http);
  }
  if (style === 'server') {
    if (!('http' in r)) add(`${at}/http`, 'required', 'a server engine is ready once readiness.http answers');
    for (const key of ['output', 'alive']) {
      if (key in r) add(`${at}/${key}`, 'forbidden', `readiness.${key} is for a tui engine`);
    }
  }
  if ('output' in r && fields(add, `${at}/output`, r.output, ['settleMs', 'timeoutSec'], [])) {
    const output = r.output as Json;
    integer(add, `${at}/output/settleMs`, output.settleMs, 0, MAX.readyMs);
    integer(add, `${at}/output/timeoutSec`, output.timeoutSec, 1, MAX.readySec);
  }
  if ('alive' in r && fields(add, `${at}/alive`, r.alive, ['ms'], [])) {
    integer(add, `${at}/alive/ms`, (r.alive as Json).ms, 0, MAX.readyMs);
  }
}

// Args for a relaunch of an agent that ran before (eviction, restart):
// appended, or put in at argv index `at` (never before the program).
function checkResume(add: Add, resume: unknown) {
  if (!fields(add, '/engine/resume', resume, ['args', 'at'], ['args'])) return;
  const r = resume as Json;
  list(add, '/engine/resume/args', r.args, { min: 1, unique: false }, (path, arg) => template(add, path, arg));
  integer(add, '/engine/resume/at', r.at, 1, MAX.resumeAt);
}

/** The engine's style when it names a known one, else null. */
export function engineStyle(m: Json): string | null {
  return isObject(m.engine) && typeof m.engine.style === 'string' ? m.engine.style : null;
}
