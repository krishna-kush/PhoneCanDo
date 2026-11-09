// The surfaces the app shows: the home tab (the kind's web UI, or its own
// TUI), the web UI's pairing and adapter, the terminal tab (a client of the
// server, or a shell in the agent's image) and the chat title regexes.
import { fields, list, oneOf, record, regex, string, type Add, type Json } from './primitives.ts';
import { HOMES, MAX, PAIR_METHODS, PALETTE_ROLES, PATTERNS } from './rules.ts';
import { command, httpPath, template } from './templates.ts';

const ADAPTER_FIELDS = ['colorSchemeKey', 'cssVars', 'hide', 'authUrl', 'sessionUrl'];
const PAIR_FIELDS = ['method', 'path', 'code', 'url'];

export function checkSurfaces(add: Add, surfaces: unknown, style: string | null) {
  if (!fields(add, '/surfaces', surfaces, ['home', 'web', 'terminal', 'chatTitle'], ['home'])) return;
  const s = surfaces as Json;
  oneOf(add, '/surfaces/home', s.home, HOMES);
  if (s.home === 'web' && !('web' in s)) add('/surfaces/web', 'required', 'a web home needs surfaces.web');
  if ('web' in s && fields(add, '/surfaces/web', s.web, ['pair', 'adapter'], ['pair', 'adapter'])) {
    if (style !== 'server') add('/surfaces/web', 'forbidden', 'a web surface needs engine.style server');
    const web = s.web as Json;
    if ('pair' in web) checkPair(add, web.pair);
    if ('adapter' in web) checkAdapter(add, web.adapter);
  }
  if ('terminal' in s) checkTerminal(add, s.terminal, style);
  if ('chatTitle' in s) {
    if (style !== 'tui') {
      add('/surfaces/chatTitle', 'forbidden', "the window title is a tui engine's; a client's is surfaces.terminal.chatTitle");
    }
    regex(add, '/surfaces/chatTitle', s.chatTitle);
  }
}

function checkPair(add: Add, pair: unknown) {
  const at = '/surfaces/web/pair';
  if (!fields(add, at, pair, PAIR_FIELDS, PAIR_FIELDS)) return;
  const p = pair as Json;
  oneOf(add, `${at}/method`, p.method, PAIR_METHODS);
  httpPath(add, `${at}/path`, p.path);
  list(add, `${at}/code`, p.code, { min: 1, unique: true }, (path, v) =>
    string(add, path, v, PATTERNS.jsonPointer, MAX.relPath),
  );
  if (httpPath(add, `${at}/url`, p.url) && !(p.url as string).includes('{{code}}')) {
    add(`${at}/url`, 'required', 'the landing URL carries {{code}}');
  }
}

function checkAdapter(add: Add, adapter: unknown) {
  const at = '/surfaces/web/adapter';
  if (!fields(add, at, adapter, ADAPTER_FIELDS, ['cssVars', 'authUrl'])) return;
  const a = adapter as Json;
  if ('colorSchemeKey' in a) string(add, `${at}/colorSchemeKey`, a.colorSchemeKey, PATTERNS.storageKey, MAX.text);
  record(add, `${at}/cssVars`, a.cssVars, (path, name, role) => {
    string(add, path, name, PATTERNS.cssVar, MAX.cssVar);
    oneOf(add, path, role, PALETTE_ROLES);
  });
  if ('hide' in a) {
    list(add, `${at}/hide`, a.hide, { min: 1, unique: true }, (path, v) =>
      string(add, path, v, PATTERNS.selector, MAX.selector),
    );
  }
  string(add, `${at}/authUrl`, a.authUrl, PATTERNS.httpPath, MAX.relPath);
  if ('sessionUrl' in a) regex(add, `${at}/sessionUrl`, a.sessionUrl);
}

// The terminal tab: the kind's TUI as a client of its server, or a shell in
// the agent's image; never both.
function checkTerminal(add: Add, terminal: unknown, style: string | null) {
  const at = '/surfaces/terminal';
  if (!fields(add, at, terminal, ['client', 'shell', 'chatTitle'], [])) return;
  const t = terminal as Json;
  if ('client' in t) {
    if (style !== 'server') add(`${at}/client`, 'forbidden', 'a terminal client needs engine.style server');
    const client = command(add, `${at}/client`, t.client, ['cwd']);
    if (client && 'cwd' in client) template(add, `${at}/client/cwd`, client.cwd);
  }
  if ('shell' in t) {
    if (typeof t.shell !== 'boolean') add(`${at}/shell`, 'type', 'must be true or false');
    else if ('client' in t) add(`${at}/shell`, 'forbidden', 'the terminal opens a client or a shell, not both');
  }
  if ('chatTitle' in t) {
    if (!('client' in t)) add(`${at}/chatTitle`, 'mismatch', "terminal.chatTitle reads the client's title, so it needs terminal.client");
    regex(add, `${at}/chatTitle`, t.chatTitle);
  }
}
