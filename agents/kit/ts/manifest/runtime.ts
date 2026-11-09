// The runtime blocks: how the engine starts and answers (engine.ts), its
// events and idle rule (events.ts), chat titles, the surfaces the app shows
// (surfaces.ts), code hooks and sign-in. The runner renders these
// (agents/kit/kotlin/render); the app reads what the native KindView passes
// on.
import { checkEngine, engineStyle } from './engine.ts';
import { checkEvents, checkIdle } from './events.ts';
import { fields, list, oneOf, string, text, type Add, type Json } from './primitives.ts';
import { MAX, PATTERNS, PHONE_TOOLS, SIGN_IN_METHODS } from './rules.ts';
import { checkSurfaces } from './surfaces.ts';
import { httpBlock } from './templates.ts';

export function checkRuntime(add: Add, m: Json) {
  const style = engineStyle(m);
  if ('engine' in m) checkEngine(add, m.engine);
  if ('events' in m) checkEvents(add, m.events, m.hooks, style);
  if ('chats' in m) checkChats(add, m.chats, style);
  if ('idle' in m) checkIdle(add, m.idle, m.events, style);
  if ('surfaces' in m) checkSurfaces(add, m.surfaces, style);
  if ('phoneTools' in m) oneOf(add, '/phoneTools', m.phoneTools, PHONE_TOOLS);
  if ('hooks' in m) checkHooks(add, m.hooks, m.id);
  if ('signIn' in m) checkSignIn(add, m.signIn);
}

// A chat's title over HTTP (server); a tui engine's comes from its window
// title (surfaces.chatTitle).
function checkChats(add: Add, chats: unknown, style: string | null) {
  if (!fields(add, '/chats', chats, ['title'], ['title'])) return;
  if (style !== 'server') add('/chats', 'forbidden', 'a chat title over HTTP needs engine.style server');
  const title = (chats as Json).title;
  if (!fields(add, '/chats/title', title, ['http'], ['http'])) return;
  const http = httpBlock(add, '/chats/title/http', (title as Json).http, ['json']);
  if (http) string(add, '/chats/title/http/json', http.json, PATTERNS.jsonPointer, MAX.relPath);
}

function checkHooks(add: Add, hooks: unknown, id: unknown) {
  list(add, '/hooks', hooks, { min: 0, unique: true }, (path, hook) => {
    if (!string(add, path, hook, PATTERNS.hookId, MAX.hookId) || typeof id !== 'string') return;
    if (!(hook as string).startsWith(`${id}.`)) add(path, 'mismatch', `a hook of ${id} is named ${id}.<name>`);
  });
}

function checkSignIn(add: Add, signIn: unknown) {
  list(add, '/signIn', signIn, { min: 0, unique: true }, (path, method) => {
    if (!fields(add, path, method, ['method', 'note'], ['method'])) return;
    const m = method as Json;
    oneOf(add, `${path}/method`, m.method, SIGN_IN_METHODS);
    if ('note' in m) text(add, `${path}/note`, m.note, MAX.note);
  });
}
