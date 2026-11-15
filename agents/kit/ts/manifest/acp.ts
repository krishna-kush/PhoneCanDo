// A tui engine's ACP mode (`engine.acp`): the command that starts the same
// agent speaking the Agent Client Protocol on stdin and stdout, with no
// screen. The runner runs it for work that comes while nobody watches (a
// scheduled task, a message that may wake the agent), in `engine.launch.cwd`,
// with its env on top of the launch env and the agent's state env.
// - argv and env: as a launch's; never {{prompt}} or {{chatId}}.
// - tools: how it gets the phone tools (session: the bridge goes in
//   session/new; config: its own config names it, as in terminal mode).
// - options: session config options set on every chat it opens.
// - meta: a JSON object passed as `_meta` when a chat opens; its strings are
//   templates as env values are; at most MAX.acpMetaBytes.
// - chat: terminal-mode args that open one given chat, in place of the
//   resume args: exactly one is {{chatId}}, whole, so the id is one argv
//   item; at an argv index (as resume's) and past a shell script's $0.
// An image kind's argv[0] is a guest program, and a user-added kind sets no
// PATH here either (kinds.ts).
import { runsScript } from './engine.ts';
import { escape, fields, integer, isObject, kindOf, list, oneOf, record, string, text, utf8Length, type Add, type Json } from './primitives.ts';
import { ACP_FIELDS, ACP_TOOLS, CHAT_PLACEHOLDER, FIRST_SCRIPT_ARG, MAX, PATTERNS } from './rules.ts';
import { command, template } from './templates.ts';

const AT = '/engine/acp';
const CHAT = `{{${CHAT_PLACEHOLDER}}}`;

export function checkAcp(add: Add, m: Json) {
  if (!isObject(m.engine) || !('acp' in m.engine)) return;
  const engine = m.engine;
  if (engine.style !== 'tui') add(AT, 'forbidden', 'an ACP mode needs a tui engine');
  const acp = command(add, AT, engine.acp, ACP_FIELDS.filter((key) => key !== 'argv' && key !== 'env'));
  if (!acp) return;
  if ('tools' in acp) oneOf(add, `${AT}/tools`, acp.tools, ACP_TOOLS);
  if ('options' in acp) checkOptions(add, acp.options);
  if ('meta' in acp) checkMeta(add, acp.meta);
  if ('chat' in acp) checkChat(add, acp.chat, engine.launch);
}

// Each config id and its value: 1 to MAX.text characters; at most MAX.acpOptions.
function checkOptions(add: Add, options: unknown) {
  const at = `${AT}/options`;
  if (!record(add, at, options, (path, id, value) => {
    if (id.length === 0 || id.length > MAX.text) add(path, 'length', `a config id is 1 to ${MAX.text} characters`);
    text(add, path, value);
  })) return;
  if (Object.keys(options as Json).length > MAX.acpOptions) add(at, 'length', `sets at most ${MAX.acpOptions} options`);
}

function checkMeta(add: Add, meta: unknown) {
  const at = `${AT}/meta`;
  if (!isObject(meta)) {
    add(at, 'type', 'must be an object');
    return;
  }
  metaValue(add, at, meta);
  if (utf8Length(JSON.stringify(meta)) > MAX.acpMetaBytes) {
    add(at, 'too-large', `at most ${MAX.acpMetaBytes / 1024} KiB as compact JSON`);
  }
}

// Strings are templates as env values are ({{password}} included); numbers,
// true, false and null pass as they are.
function metaValue(add: Add, path: string, value: unknown) {
  if (typeof value === 'string') template(add, path, value, true);
  else if (Array.isArray(value)) value.forEach((v, i) => metaValue(add, `${path}/${i}`, v));
  else if (isObject(value)) for (const [key, v] of Object.entries(value)) metaValue(add, `${path}/${escape(key)}`, v);
  else if (!['number', 'boolean', 'null'].includes(kindOf(value))) add(path, 'type', 'must be JSON');
}

function checkChat(add: Add, chat: unknown, launch: unknown) {
  const at = `${AT}/chat`;
  if (!fields(add, at, chat, ['args', 'at'], ['args'])) return;
  const c = chat as Json;
  if (list(add, `${at}/args`, c.args, { min: 1, unique: false }, (path, arg) => chatArg(add, path, arg))) {
    const naming = c.args.filter((arg) => typeof arg === 'string' && arg.includes(CHAT));
    if (naming.length !== 1 || naming[0] !== CHAT) add(`${at}/args`, 'mismatch', `holds ${CHAT} as one whole arg, once`);
  }
  integer(add, `${at}/at`, c.at, 1, MAX.resumeAt);
  if (typeof c.at === 'number' && c.at < FIRST_SCRIPT_ARG && runsScript(launch)) {
    add(`${at}/at`, 'range', `a shell script's own args start at ${FIRST_SCRIPT_ARG} (after its $0); leave at out to append`);
  }
}

// A template that may also name {{chatId}}; no secret.
function chatArg(add: Add, path: string, value: unknown) {
  if (typeof value === 'string' && value.includes(CHAT)) {
    string(add, path, value, PATTERNS.chatTemplate, MAX.template);
    return;
  }
  template(add, path, value);
}
