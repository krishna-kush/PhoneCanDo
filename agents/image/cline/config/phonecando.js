// phonecando-managed: cline plugin (launch.sh copies this file into
// $CLINE_DIR/plugins and replaces it while this line is here; delete the
// line and it is yours, and we never touch it again).
//
// PhoneCanDo's Cline plugin. Cline loads every .js file in its plugin
// folders into each session (TUI, hub and ACP alike) and runs its hooks in a
// worker, each with a 3 s budget (cli-v3.0.74 `docs/sdk/plugins.mdx`,
// `sdk/packages/core/src/extensions/plugin/plugin-sandbox.ts`). It does
// nothing unless the runner gave this engine our variables, so a `cline`
// you run yourself in the machine's terminal is untouched.
//
// - Trust: our own phone tools (`phonecando__*`, from our stdio MCP server)
//   run without Cline's approval prompt; the phone-control lock is their
//   check. Every other tool keeps your auto-approve setting. A beforeTool
//   hook's `policy` is merged over the session's tool policies before the
//   agent loop decides to ask (`sdk/packages/agents/src/agent-runtime.ts`).
// - Events: tells the phone when a run starts, when Cline asks you a
//   question, and how the run ended, through the kit's phonecando-event
//   script. Sub-agents' runs (a parent agent id) raise nothing.
// - Messages from other agents ($PHONECANDO_INBOX, read as the kit's
//   phonecando-inbox script reads it): taken into a run at its start and
//   after each tool (hook context, which the model reads before its next
//   request); while Cline is idle, a set the runner marked as allowed to
//   wake it is queued as a prompt, which starts a turn
//   (`emitEvent("queue_message")`). Anything else waits for your next
//   prompt.
// - A first prompt handed over by launch.sh ($PHONECANDO_CLINE_PROMPT: a
//   run brought back, a note to go on, while it reopens a chat with
//   `--id`, which takes no prompt): sent into that chat once the session
//   is set up, then deleted. One older than PROMPT_MAX_MS is dropped, so
//   it never runs in a later session.
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/** Our MCP server's tools, as Cline names them (`<server>__<tool>`). */
export const OWN_TOOLS = 'phonecando__';
/** Cline's own tools that wait on your answer. */
export const ASK_TOOLS = ['ask_question', 'ask_followup_question'];
/** What this plugin raises; agent.json `events[].hook.map` maps each to an engine event. */
export const EVENTS = {
  start: 'RunStart',
  ask: 'AskUser',
  answered: 'AskDone',
  done: 'RunDone',
  failed: 'RunFailed',
  stopped: 'RunStopped',
};

const EVENT_SCRIPT = '/root/.phonecando/bin/phonecando-event';
const PENDING = 'pending';
const WAKE = 'wake';
// How often an idle session looks in the folder: one stat, no process.
const EVERY_MS = 1000;
// A queued wake that never started a run frees the next look after this.
const QUEUED_MS = 30_000;
/** How old a handed-over first prompt may be: a launch's own, never a later session's. */
export const PROMPT_MAX_MS = 120_000;

/** Whether a tool is one of ours, which never waits on Cline's approval. */
export function trusted(toolName) {
  return typeof toolName === 'string' && toolName.startsWith(OWN_TOOLS) && toolName.length > OWN_TOOLS.length;
}

/** A sub-agent's run (spawned by the main one) has a parent. */
export function isSubAgent(snapshot) {
  return Boolean(snapshot?.parentAgentId);
}

/** The event for a run's end, from its `result` (`AgentRunResult`). */
export function endEvent(result) {
  if (result?.status === 'aborted') return EVENTS.stopped;
  if (result?.status === 'failed' || result?.error) return EVENTS.failed;
  return EVENTS.done;
}

/** Whether messages wait in [inbox], and whether they may wake the agent. */
export function peek(inbox) {
  const pending = join(inbox, PENDING);
  return { waiting: existsSync(pending), wake: existsSync(join(pending, WAKE)) };
}

/**
 * The waiting messages, now ours and receipted; null with none, or when
 * another reader took them. Takes the whole set by renaming pending/
 * (atomic: of two readers one gets it), appends `@inbox TAB <ids>` to the
 * events file so the runner marks them read, and removes what it took.
 */
export function claim(inbox, events) {
  const claimed = join(inbox, `claimed.${process.pid}`);
  rmSync(claimed, { recursive: true, force: true });
  try {
    renameSync(join(inbox, PENDING), claimed);
  } catch {
    return null;
  }
  try {
    const ids = read(claimed, 'ids').split(/\s+/).filter((id) => /^\d+$/.test(id));
    const text = read(claimed, 'messages.txt').trim() || blocks(read(claimed, 'messages.jsonl'));
    const wake = existsSync(join(claimed, WAKE));
    if (ids.length > 0 && events) receipt(events, ids);
    return { ids, text, wake };
  } finally {
    rmSync(claimed, { recursive: true, force: true });
  }
}

// One line in one write to an O_APPEND file, as the kit's scripts do, so
// lines from hooks that write at once stay whole.
/**
 * The first prompt launch.sh handed over in [file], taken (the file is
 * deleted either way); undefined when there is none, it is not ours or it
 * is older than PROMPT_MAX_MS.
 */
export function takePrompt(file, now = Date.now()) {
  if (!file || !existsSync(file)) return undefined;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return undefined;
  } finally {
    rmSync(file, { force: true });
  }
  try {
    const { at, prompt } = JSON.parse(text);
    if (typeof prompt !== 'string' || !prompt || typeof at !== 'number') return undefined;
    return now - at >= 0 && now - at <= PROMPT_MAX_MS ? prompt : undefined;
  } catch {
    return undefined;
  }
}

function receipt(events, ids) {
  try {
    appendFileSync(events, `@inbox\t${ids.join(' ')}\n`);
  } catch {
    // The runner does not hear of it; the messages reach the chat all the same.
  }
}

function read(dir, name) {
  try {
    return readFileSync(join(dir, name), 'utf8');
  } catch {
    return '';
  }
}

// The rendered blocks of messages.jsonl, for a set without messages.txt.
function blocks(jsonl) {
  const out = [];
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue;
    try {
      const block = JSON.parse(line)?.block;
      if (typeof block === 'string' && block) out.push(block);
    } catch {
      // A torn line: the others still go.
    }
  }
  return out.join('\n\n');
}

// Never waits on the script and never fails Cline over it.
function raiseEvent(name) {
  try {
    const child = spawn('sh', [EVENT_SCRIPT, name], { stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
  } catch {
    // No event this time.
  }
}

/**
 * The plugin for this environment. Only `name` and `manifest` when the
 * runner set none of our variables. [raise] and [every] are for tests.
 */
export function createPlugin({ env = process.env, raise = raiseEvent, every = EVERY_MS, now = Date.now } = {}) {
  const plugin = { name: 'phonecando', manifest: { capabilities: ['hooks'] } };
  const bridge = Boolean(env.PHONECANDO_BRIDGE_URL);
  const events = env.PHONECANDO_EVENTS || undefined;
  const inbox = env.PHONECANDO_INBOX || undefined;
  const handed = env.PHONECANDO_CLINE_PROMPT || undefined;
  if (!bridge && !events && !inbox) return plugin;

  // One worker per session, so this is the session's.
  let running = false;
  let queuedAt = 0;
  const say = (name) => {
    if (events) raise(name);
  };
  const take = () => {
    if (!inbox) return undefined;
    try {
      const c = claim(inbox, events);
      return c?.text ? { appendContext: c.text } : undefined;
    } catch {
      return undefined;
    }
  };

  plugin.setup = (_api, ctx) => {
    if (ctx?.client?.name === 'cline-acp') return;
    const emit = typeof ctx?.emitEvent === 'function' ? ctx.emitEvent : globalThis.__clinePluginHost?.emitEvent;
    if (typeof emit !== 'function') return;
    try {
      const first = takePrompt(handed, now());
      if (first) {
        queuedAt = now();
        emit('queue_message', { prompt: first });
      }
    } catch {
      // The prompt is lost; the chat is open for you to go on.
    }
    if (!inbox) return;
    const timer = setInterval(() => {
      try {
        if (running || now() - queuedAt < QUEUED_MS) return;
        const p = peek(inbox);
        if (!p.waiting || !p.wake) return;
        const c = claim(inbox, events);
        if (!c?.text) return;
        queuedAt = now();
        emit('queue_message', { prompt: c.text });
      } catch {
        // Never break Cline over a message; the next look tries again.
      }
    }, every);
    timer.unref?.();
    ctx?.onDispose?.(() => clearInterval(timer));
  };

  plugin.hooks = {
    beforeRun(ctx) {
      if (isSubAgent(ctx?.snapshot)) return undefined;
      running = true;
      queuedAt = 0;
      say(EVENTS.start);
      return take();
    },
    afterRun(ctx) {
      if (isSubAgent(ctx?.snapshot)) return;
      running = false;
      say(endEvent(ctx?.result));
    },
    beforeTool(ctx) {
      const name = ctx?.toolCall?.toolName ?? ctx?.tool?.name;
      if (!isSubAgent(ctx?.snapshot) && ASK_TOOLS.includes(name)) say(EVENTS.ask);
      return bridge && trusted(name) ? { policy: { autoApprove: true } } : undefined;
    },
    afterTool(ctx) {
      const name = ctx?.toolCall?.toolName ?? ctx?.tool?.name;
      if (isSubAgent(ctx?.snapshot)) return undefined;
      if (ASK_TOOLS.includes(name)) say(EVENTS.answered);
      return take();
    },
  };
  return plugin;
}

export default createPlugin();
