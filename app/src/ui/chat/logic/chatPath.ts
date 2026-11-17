// Where an agent's web UI shows one chat, for Home to go there (openChat:
// a scheduled run's notice or its row on the Schedules page). First a page
// of this agent that shows a chat, with the asked chat's id in place of
// its own (group 1 of the kind's sessionUrl regex), so the route is the web
// UI's own. Without one, the kind's sessionPath template from its web
// adapter: {{sessionId}}, and {{origin64}} for the page's origin as
// base64url (a web UI that keeps its chats under the server they live on).
// That route is used only when the kind's regex reads the chat back from
// it. No RN imports.
import { splitUrl } from '../lastPage.ts';

/**
 * The URL that shows [chatId] for a view now at [at]: on its origin, from
 * the page it is on or one of [pages] (paths this agent's view was on),
 * else [sessionPath] filled in. Null when it shows that chat already or no
 * route fits, so Home just shows.
 */
export function chatUrl(
  sessionUrl: string,
  sessionPath: string | null,
  at: string,
  chatId: string,
  pages: readonly (string | null)[],
): string | null {
  const here = splitUrl(at);
  if (!here || !chatId) return null;
  if (chatOf(sessionUrl, here.path) === chatId) return null;
  for (const page of [here.path, ...pages]) {
    const path = page ? swapChat(sessionUrl, page, chatId) : null;
    if (path) return here.origin + path;
  }
  const built = sessionPath ? fillPath(sessionPath, here.origin, chatId) : null;
  return built && chatOf(sessionUrl, built) === chatId ? here.origin + built : null;
}

/**
 * [path] with [chatId] in place of the chat it shows, and what followed
 * that chat (a sub-page, a query, a hash) left off; null when it shows none.
 */
export function swapChat(sessionUrl: string, path: string, chatId: string): string | null {
  const m = new RegExp(sessionUrl).exec(path);
  if (!m || !m[1]) return null;
  const start = m.index + m[0].lastIndexOf(m[1]);
  return path.slice(0, start) + encodeURIComponent(chatId);
}

/** [template] (a kind's sessionPath) for [chatId] on a page at [origin]; null if the origin won't encode. */
export function fillPath(template: string, origin: string, chatId: string): string | null {
  const origin64 = template.includes('{{origin64}}') ? base64Url(origin) : '';
  if (origin64 == null) return null;
  return template.replace(/\{\{origin64\}\}/g, origin64).replace(/\{\{sessionId\}\}/g, encodeURIComponent(chatId));
}

function chatOf(sessionUrl: string, path: string): string | null {
  const m = new RegExp(sessionUrl).exec(path);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

// base64url: base64 with - and _ for + and /, no padding. An origin is
// ASCII, so btoa takes it as is.
function base64Url(text: string): string | null {
  try {
    return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return null;
  }
}
