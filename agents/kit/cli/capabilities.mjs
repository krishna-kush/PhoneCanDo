// What each agent kind can do, one row per kind, read from its manifest
// (list.mjs --capabilities): the facts the runner acts on, side by side.
//   mode        its engine: tui or server
//   acp         it has an ACP mode (engine.acp)
//   tools       how it loads our phone tools (phoneTools)
//   trust       where it trusts our server (phoneToolsTrust.in)
//   prompt      its TUI starts with a first prompt (engine.prompt)
//   resume      a relaunch reopens its last chat (engine.resume)
//   wake        its own wake while idle (inbox.wake: hook, reader, server)
//   messages    how far other agents' messages reach it, as the site's
//               cards say it (web/src/data/agentCards.ts)
//   again       what Start me again does while it sits idle in its own app
//               with no jobs, as the runner's presence/ResumeRules decides:
//               woken in place, restarted in the same chat with the note,
//               switched to ACP mode in the chat its terminal left (only
//               when its ACP mode lists its chats, which the phone learns
//               as it starts: AcpListing), or the note waits for its next
//               turn. "-" for a kind with no phone tools: nothing hands
//               the phone over to it.

const MCP = ['mcp:argv', 'mcp:config'];

function messages(m) {
  if (m.inbox) return m.inbox.wake ? 'wakes' : 'delivered';
  return (m.phoneTools ?? 'none') !== 'none' ? 'inbox' : 'none';
}

function again(m) {
  if ((m.phoneTools ?? 'none') === 'none') return '-';
  if (m.inbox?.wake) return 'woken';
  if (m.engine?.prompt && m.engine?.resume) return 'restart';
  if (m.engine?.acp) return 'acp if listed';
  return 'waits';
}

const yes = (v) => (v ? 'yes' : '-');

/** One row per kind: the columns above, by name. */
export function capabilities(entries) {
  return entries.map(({ id, manifest: m }) => ({
    id,
    mode: m.engine?.style ?? '-',
    acp: yes(m.engine?.acp),
    tools: m.phoneTools ?? 'none',
    trust: m.phoneToolsTrust?.in ?? (MCP.includes(m.phoneTools) ? 'MISSING' : '-'),
    prompt: yes(m.engine?.prompt),
    resume: yes(m.engine?.resume),
    wake: m.inbox?.wake ?? '-',
    messages: messages(m),
    again: again(m),
  }));
}

export const COLUMNS = ['id', 'mode', 'acp', 'tools', 'trust', 'prompt', 'resume', 'wake', 'messages', 'again'];

/** The rows as an aligned plain-text table, with a header line. */
export function table(rows) {
  const width = Object.fromEntries(COLUMNS.map((c) => [c, Math.max(c.length, ...rows.map((r) => String(r[c]).length))]));
  const line = (r) => COLUMNS.map((c) => String(r[c]).padEnd(width[c])).join('  ').trimEnd();
  return [line(Object.fromEntries(COLUMNS.map((c) => [c, c]))), ...rows.map(line)];
}
