// The ACP handshake as our runner makes it (app/modules/phonecando-runner/
// .../engine/acp/AcpWire.kt): JSON-RPC 2.0, one message per line; we offer
// no file system, no terminal and no sign-in through one, and answer any
// request the agent makes with "method not found". Pure: the messages and
// what an initialize answer lacks.

export const PROTOCOL_VERSION = 1;
export const METHOD_NOT_FOUND = -32601;
export const INITIALIZE_ID = 1;

/** AcpWire.initialize(version) as a request line. */
export function initializeRequest(version) {
  return JSON.stringify({
    jsonrpc: '2.0',
    id: INITIALIZE_ID,
    method: 'initialize',
    params: {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {
        fs: { readTextFile: false, writeTextFile: false },
        terminal: false,
        auth: { terminal: false },
      },
      clientInfo: { name: 'phonecando', title: 'PhoneCanDo', version },
    },
  });
}

/**
 * One line from the agent: {kind: 'answer', result, error} for our
 * initialize, {kind: 'request', reply} for a request it makes of us (the line
 * to send back), or null for anything else (a notification, not JSON, an id
 * we never sent), as AcpWire.parse reads lines.
 */
export function readLine(line) {
  let o;
  try {
    o = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return null;
  const id = o.id ?? null;
  if (typeof o.method === 'string') {
    if (id === null) return null;
    const error = { code: METHOD_NOT_FOUND, message: `${o.method} is not offered` };
    return { kind: 'request', reply: JSON.stringify({ jsonrpc: '2.0', id, error }) };
  }
  if (Number(id) !== INITIALIZE_ID) return null;
  return { kind: 'answer', result: o.result ?? {}, error: o.error ?? null };
}

/** The value at a dotted path (`agentCapabilities.loadSession`); undefined when a step is missing. */
export function valueAt(result, path) {
  let at = result;
  for (const key of path.split('.')) {
    if (typeof at !== 'object' || at === null || !Object.hasOwn(at, key)) return undefined;
    at = at[key];
  }
  return at;
}

/** The required paths that are not truthy in the answer, each with what it holds. */
export function lacking(result, paths) {
  return paths.map((path) => ({ path, value: valueAt(result, path) })).filter(({ value }) => !value);
}

/** Who answered: `agentInfo.name agentInfo.version`, when it says. */
export function agentOf(result) {
  const info = result?.agentInfo;
  return [info?.name, info?.version].filter((s) => typeof s === 'string' && s).join(' ');
}

/** What an answer that lacks paths is missing, for a failure line. */
export function describeLacking(missing) {
  return missing.map(({ path, value }) => `${path} (${value === undefined ? 'absent' : JSON.stringify(value)})`).join(', ');
}
