# Adding an agent

PhoneCanDo runs coding agents on an Android phone. Each agent it knows is
an agent *kind*: a folder in `agents/` whose manifest, `agent.json`, says
how to install the agent into its Linux machine, start its terminal UI
and connect it to the phone. Read this if you use or make a coding agent
(a CLI) that PhoneCanDo doesn't ship and want every feature for it. The
full rules are in [`agents/AGENTS.md`](../../agents/AGENTS.md); every
field is in [the schema](../../agents/kit/schema/agent.schema.json).

## Two ways in

### Just for you: add it in the app

Open the drawer, then **Custom agents**:

- **Add your own agent**: a form for the install script (or a package),
  the command that starts the agent, its ACP command, phone tools and a
  few more settings. New agent → Choose agent has the same button.
- **Import**: paste an agent file (the JSON someone shared from their own
  Custom agents list).

A custom agent works at once, with no app update. It can't ship our files
into its machine (such as a settings file that adds hooks or an MCP
server), so the features below that need them need a kind in this repo,
or your own edits to the agent's settings inside its machine.

### For everyone: add a kind to this repo

Add one folder, `agents/image/<id>/`, and open a pull request. Once it is
merged, every PhoneCanDo user can pick your agent. Every built-in agent
except opencode is such a folder, so `agents/image/` has many examples.

## If your agent has an ACP mode

The [Agent Client Protocol](https://agentclientprotocol.com) (ACP) lets a
client drive a coding agent over stdin and stdout, with no screen. Look
for an `--acp` flag or an `acp` command in your CLI's `--help`, or for its
entry in the Registry on agentclientprotocol.com. Some agents have an
adapter instead, such as Claude Code's `claude-agent-acp`.

If it has one, that is almost all you need. Name the command in
`engine.acp`, and work that comes while nobody watches runs through it:

- **Scheduled tasks** start the agent in ACP mode with the task as its
  prompt.
- **Messages from other agents** wake an idle agent, as a prompt.
- **Questions** the agent asks (may I run this, may I edit that) come to
  the phone as permission prompts.
- **Phone tools**: with `tools: "session"` (the default) the app hands
  our MCP server over when a chat opens. The kind still needs a
  `phoneTools` value (below); with `"none"` it gets none in either mode.

```json
"acp": {
  "argv": ["/root/.local/bin/mycli", "--acp"],
  "options": { "mode": "default" },
  "chat": { "args": ["--resume", "{{chatId}}"], "at": 1 }
}
```

`argv` (required) and `env` work like `engine.launch`'s. `tools` is
`session`, or `config` when our settings file already names our MCP
server. `options` are chat settings: `mode: default` makes Claude Code
and Qwen Code ask you on the phone instead of deciding alone. `chat` holds
the terminal flags that open one given chat, so Home shows the chat the
background run used.

Opening Home switches the agent back to its terminal UI. A message for a
busy agent still gets in only through hooks or `agents_inbox`, and the
terminal UI's status needs `events` (below). Rules: [ACP
mode](../../agents/AGENTS.md#acp-mode). Examples: `qwen-code`,
`claude-code` (an adapter), `cline` (argv only).

## If it has no ACP mode: feature by feature

| Feature | What your CLI needs | Block | Example |
|---|---|---|---|
| Phone tools | an HTTP MCP client, set up from a flag or an extra config file | `phoneTools` | `claude-code`, `qwen-code` |
| Scheduled tasks | a flag that starts the TUI with a first prompt | `engine.prompt` | `qwen-code` |
| Messages from other agents | hooks whose output joins the turn, or an extension API | `inbox` | `claude-code`, `pi` |
| Waking while idle | a hook or extension that starts a turn by itself | `inbox.wake` | `claude-code`, `pi` |
| Working, waiting, finished | hooks, or terminal signals | `events` | `qwen-code`, `crush` |
| Resume | a flag that reopens the last chat | `engine.resume` | most kinds |
| Two agents on one machine | an env var that moves all its state | `state` | `claude-code` |
| Local models | a model server from env or flags, and a one-shot mode | `models` | `qwen-code` |
| Sign-in notes | nothing | `signIn` | every kind |

**Our files.** We never write into the agent's own config. What we add
(hooks, our MCP server) goes in the kind's `config/` folder, which the app
copies into the machine on every start (`"config": { "dir": "config",
"into": ".phonecando/mycli" }`). So your CLI must load one more settings
file named by a flag or an env var (Claude Code's `--settings`, Qwen
Code's `QWEN_CODE_SYSTEM_SETTINGS_PATH`). One that reads hooks or MCP
servers only from its own config file gets neither.

### Phone tools

The phone tools (`mobile_*`) and the agent tools (`agents_*` for
messages, `schedule_*` for tasks) come from one MCP server on the phone.
Your CLI needs an HTTP MCP client that our settings file (`mcp:config`)
or a flag (`mcp:argv`) can point at it. The token is only ever an env
reference that your CLI expands itself, never in argv or on disk:

```json
{ "mcpServers": { "phonecando": {
  "httpUrl": "${PHONECANDO_BRIDGE_URL}/mcp",
  "headers": { "Authorization": "Bearer ${PHONECANDO_BRIDGE_TOKEN}" } } } }
```

A flag that needs the URL as `{{bridgeUrl}}` goes in a launch item
`{ "when": "bridgeUrl", "args": [...] }`, so it drops out when phone
tools are off (`codex`). `plugin` means the CLI's own extension adds the
server (`pi`). With no way at all, say `"phoneTools": "none"`; every kind
names it. Rules: [Phone tools](../../agents/AGENTS.md#phone-tools).

Our tools never wait on your CLI's own approval prompt; the phone-control
lock is their check. So with `mcp:config` or `mcp:argv`, also load your
CLI's setting that trusts that one server (never its shell or file tools),
and name where it is: `"phoneToolsTrust": { "in": "settings.json", "has":
"mcp__phonecando" }`, with `in` a file in your config folder or `"argv"`,
and `has` the text that must be there.

### Scheduled tasks

A scheduled task starts the agent with the task as its first prompt. Your
CLI needs a flag that starts the interactive TUI with that prompt and
stays open, such as `qwen --prompt-interactive "<task>"`; a one-shot mode
that answers and exits (`-p`) won't do. Exactly one arg is `{{prompt}}`,
whole: `"prompt": { "args": ["--prompt-interactive", "{{prompt}}"] }`.
Put `--` before it when an earlier flag could swallow it. With no
`prompt`, no `inbox.wake` and no ACP mode, a kind can't run them.

### Messages from other agents

With phone tools alone, an agent reads other agents' messages when it
calls `agents_inbox`; every result from our tools tells it when some are
waiting. To push them into a running turn, your CLI needs hooks that run a shell command (after
tool calls, when a prompt is sent) and add its output to the model's
context. The hook runs `sh /root/.phonecando/bin/phonecando-inbox
<Event>`, which prints that event's template, filled in:

```json
"inbox": { "hooks": { "PostToolBatch": { "format": "json",
  "template": { "hookSpecificOutput": { "hookEventName": "PostToolBatch", "additionalContext": "{{messages}}" } } } } }
```

Or `"reader": true`: the CLI's own extension reads the inbox folder
(`$PHONECANDO_INBOX`) itself, as `pi` does.

**Waking while idle.** `inbox.wake` says how a message can start a turn
while the agent is idle. `hook`: a hook that waits in the background and
starts a turn by itself (Claude Code's `Stop` hook with `asyncRewake`
runs `phonecando-inbox --wait Stop 3600`). `reader`: the extension starts
one (`pi`). Without it, and without ACP, messages wait for the next turn.
Rules: [Messages from other agents](../../agents/AGENTS.md#messages-from-other-agents).

### Working, waiting, finished

The app shows each agent as working, waiting for you, finished or failed,
and alerts you. It learns this from hooks or from the terminal:

- **Hooks** run `sh /root/.phonecando/bin/phonecando-event <Name>`;
  `events[].hook.map` maps each name to `working`, `waiting`, `finished`,
  `failed` or `stopped`: `{ "hook": { "map": { "Stop": "finished" } } }`.
- **Terminal signals**: the bell, OSC 9 or OSC 777 notifications, OSC
  9;4 progress, or best of all OSC 7501, the [Program Status
  Protocol](https://www.superlogical.com/rex/docs/build/program-status);
  `events[].pty.rules` maps them, with an optional `match` regex:
  `{ "on": "osc7501", "match": "^state=done", "event": "finished" }`.
  Map OSC 7501's `idle` to `stopped`, never to `finished`.

Rules: [Engine styles](../../agents/AGENTS.md#4-engine-styles).

### Resume

When an agent ran before, the app adds `resume.args` so its TUI reopens
the last chat: `"resume": { "args": ["--continue"], "at": 1 }`. If it
exits with an error because there was nothing to resume, the app starts
it once more without them.

### Two agents on one machine

Agents share a machine like apps on one PC. Two agents of the same kind
can share one only if your CLI can keep its sign-in, settings and chats
in another folder, moved by an env var (Claude Code's
`CLAUDE_CONFIG_DIR`). `{{stateDir}}` is that agent's own folder.

```json
"instructions": ".mycli/AGENTS.md",
"state": { "env": { "MYCLI_HOME": "{{stateDir}}/mycli" }, "instructions": "mycli/AGENTS.md" },
"userState": [".mycli"]
```

`instructions` is your CLI's global instructions file, where the app adds
a note about the phone and the machine's other agents. `userState` is
where it keeps a user's sign-in and chats by default, removed when the
agent leaves a machine that stays: never its install or anything shared.
Rules: [Instructions and an agent's own state](../../agents/AGENTS.md#instructions-and-an-agents-own-state).

### Local models

The app can serve a model on the phone. Your CLI needs to take an
OpenAI-compatible (`openai-chat`, `openai-responses`) or `anthropic`
endpoint, model and key from env vars or flags, not only from its config
file, plus a one-shot mode that prints a reply and exits 0:

```json
"models": { "openai-chat": { "env": {
  "OPENAI_BASE_URL": "{{baseUrl}}/v1", "OPENAI_API_KEY": "{{modelKey}}", "OPENAI_MODEL": "{{model}}" } } }
```

The one-shot mode goes in `one-shot.json` beside `agent.json`:
`{ "argv": ["/root/.local/bin/mycli", "-p", "{{prompt}}"] }`. CI's
local-model check (`local-models.yml`) installs the kind as the phone
does and runs that against our model server; the `models` block stays
only once it passes. Rules: [Local models](../../agents/AGENTS.md#local-models).

### Sign-in notes

Sign-in happens inside your agent, and we never take part. `signIn` lists
the ways (`device-code`, `paste-code`, `browser`, `api-key`, `in-tui`,
`in-ui`), each with a note of at most 200 characters that the app shows,
such as `{ "method": "browser", "note": "Run /login." }`. A link your CLI
opens through `$BROWSER` becomes the phone's "open this link" prompt, and
a sign-in page can return to a localhost port.

## Show it works before you add a block

A kind gets a block only once your CLI's docs or source show that it
works: a docs page, or a source file at a named version. The kind's
`README.md` says where, and what you tried (a full turn, or just the
start-up). Leave out what isn't shown, and say why: `crush`'s README
explains why it has no `prompt` and no phone tools. An ACP mode's section
also says why each field is set and what is still to check on a phone.

## The phone checks it too

Each agent's page has **What it can do**: one line per feature, which
reads Checked, Not checked yet, Not working or Off. The phone watches real
use for exact signs, and never guesses:

- phone tools: a request to our tools with that agent's own token;
- messages: our inbox script reports each hook the first time it runs;
- waking: the waiting hook reports when it starts;
- scheduled tasks: a working event, or the task's text on its screen,
  soon after a start with a task; quitting right away fails it;
- its own folder: something in it changes during its first turn;
- ACP mode: a chat opens; "open this chat": the terminal stays up on it.

A feature fails only on a sign it can't miss, such as a whole turn with
no hook run. Then you get one notification, a scheduled run says why it
failed, a waiting message says why it waits, and the agent's level drops
to what works. A feature not checked yet is still used as set up. A
check belongs to the exact setting: change the block and it reads Not
checked yet again. **Check now** on that page runs one short test task in
a new chat, so you can see your block work before you send it. When your
kind has a `models` block, the check runs it on our check model, a
stand-in that answers "done" at once, so the result never depends on a
model's speed or answer; without one, it asks the agent's own model.

## How to send it

You need Node 22 or newer with pnpm (`pnpm -C agents install` once), and
a JDK for Gradle (CI uses 17).

1. `./manage agent new <id> --image` creates `agents/image/<id>/` with an
   `agent.json` and a `README.md` to fill in. The id is lowercase letters
   and digits, words joined by `-`.
2. Fill in `agent.json`: `label`, `licence` (`redistributed: false`: the
   phone installs it from the vendor), `requires` (`node>=22` and the
   like, from `agents/runtimes/`), `install` (packages per family, then
   steps), `update`, `versionCheck`, `engine`, `phoneTools` and the blocks
   above. A failed step runs again, so make each one safe to rerun; turn
   the agent's own self-update off. Rules:
   [Image kinds](../../agents/AGENTS.md#image-kinds).
3. Add `NOTICE.md` (who makes it, its licence, and that we install it
   unmodified from the vendor) and any `config/` files.
4. Write `README.md`: install, launch, state, ACP mode, events, messages,
   phone tools, local models and sign-in, each with its evidence, or
   "None:" and why.
5. Run the checks ([Verify](../../agents/AGENTS.md#8-verify)):
   `node agents/kit/cli/check.mjs` (or `./manage agent check`) for the
   manifest and folder, `pnpm -C agents check` for types, dependency rules
   and tests, and `cd agents && ./gradlew build` for the kit's JVM tests.
6. Open a pull request at
   [krishna-kush/PhoneCanDo](https://github.com/krishna-kush/PhoneCanDo)
   that says what you tried, with which version.

PhoneCanDo is source-available, not open source: you may read the code
and contribute, and contributions come under the terms in
[`LICENSE`](../../LICENSE).

## Ask your agent's makers

If a feature needs something your CLI lacks, such as hooks, an MCP
client, or a flag that starts the TUI with a prompt, ask its makers for
it. One request goes furthest: an ACP mode. With it, PhoneCanDo gets
scheduled tasks, waking messages and permission prompts on the phone with
no more work, and so does every other ACP client.
