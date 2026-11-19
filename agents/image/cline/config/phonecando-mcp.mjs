// Seeded by PhoneCanDo into /root/.phonecando/cline and started by Cline as
// the `phonecando` stdio MCP server (our cline_mcp_settings.json). Cline
// expands no variables in its MCP settings, so it can't name the bridge
// itself: this relays each newline-delimited JSON-RPC message from Cline to
// the phone tools' bridge (Streamable HTTP, POST <url>/mcp) and writes each
// answer back as one line. Lines are handled at once, so a call that waits
// (agents_wait, a prompt on the phone) never holds up the others.
//
// The URL and token come from the environment only: PHONECANDO_MCP_URL and
// PHONECANDO_MCP_TOKEN once Cline fills in the `${env:...}` our settings give
// them, else the PHONECANDO_BRIDGE_URL and PHONECANDO_BRIDGE_TOKEN it passes
// down. The token is never printed, logged or written. Loopback only, and
// never through an HTTP proxy (an Agent of our own reads no proxy env).
import { Agent, STATUS_CODES, request } from 'node:http';
import { createInterface } from 'node:readline';

const RPC_ERROR = -32000;

function fromEnv(alias, name) {
  const value = process.env[alias];
  return value && !value.startsWith('${') ? value : process.env[name];
}

function quit(why) {
  process.stderr.write(`phonecando-mcp: ${why}\n`);
  process.exit(1);
}

function isLoopback(host) {
  return host === 'localhost' || host === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(host);
}

const base = fromEnv('PHONECANDO_MCP_URL', 'PHONECANDO_BRIDGE_URL');
const token = fromEnv('PHONECANDO_MCP_TOKEN', 'PHONECANDO_BRIDGE_TOKEN');
if (!base || !token) quit('no PhoneCanDo bridge in this environment (phone tools are off for this agent)');
let endpoint;
try {
  endpoint = new URL(`${base.replace(/\/+$/, '')}/mcp`);
} catch {
  quit('the bridge URL is not a URL');
}
if (endpoint.protocol !== 'http:' || !isLoopback(endpoint.hostname)) quit('the bridge must be http:// on loopback');

// A new connection per message (cheap on loopback): a kept one the bridge
// closed while idle would fail the next call.
const agent = new Agent();
let sessionId; // Mcp-Session-Id, kept once the bridge gives one (ours is stateless and gives none)

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function fail(id, message) {
  if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: RPC_ERROR, message: `PhoneCanDo bridge: ${message}` } });
}

function post(body) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${token}`,
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  return new Promise((resolve, reject) => {
    const req = request(endpoint, { method: 'POST', agent, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () =>
        resolve({
          status: res.statusCode ?? 0,
          type: res.headers['content-type'] ?? '',
          session: res.headers['mcp-session-id'],
          text: Buffer.concat(chunks).toString('utf8'),
        }),
      );
    });
    req.on('error', reject);
    req.end(body);
  });
}

// The JSON-RPC messages in an answer: a JSON body, or each `data:` event of
// an SSE body (read whole: the bridge answers one message per POST).
function messages({ type, text }) {
  if (!text.trim()) return [];
  if (!type.includes('text/event-stream')) return [JSON.parse(text)];
  const out = [];
  let data = [];
  for (const line of `${text}\n\n`.split(/\r?\n/)) {
    if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    else if (line === '' && data.length) {
      out.push(JSON.parse(data.join('\n')));
      data = [];
    }
  }
  return out;
}

async function relay(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    // Cline tries Content-Length framing after a failed newline start; we
    // speak newline only, so leave at once rather than let it wait out its
    // timeout.
    if (/^content-length\s*:/i.test(line)) quit('speaks newline-delimited JSON only');
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    return;
  }
  // A request gets an answer whatever happens; a notification or a response never does.
  const id = message && typeof message === 'object' && 'method' in message && message.id != null ? message.id : undefined;
  try {
    const res = await post(line);
    if (res.session && !sessionId) sessionId = res.session;
    if (res.status < 200 || res.status > 299) return fail(id, `HTTP ${res.status} ${STATUS_CODES[res.status] ?? ''}`.trim());
    let answers;
    try {
      answers = messages(res);
    } catch {
      return fail(id, 'its answer is not JSON');
    }
    answers.forEach(send);
    if (!answers.length) fail(id, `no answer (HTTP ${res.status})`);
  } catch (e) {
    fail(id, `can't be reached (${e?.code ?? 'error'})`);
  }
}

process.stdout.on('error', () => process.exit(0));
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on('line', (line) => {
  if (line.trim()) void relay(line.trim());
});
input.on('close', () => process.exit(0));
