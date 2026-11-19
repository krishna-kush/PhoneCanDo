# kimi-code

Moonshot AI's Kimi Code CLI, installed from npm on our `node` runtime and
run as a TUI in the agent's machine. Shared image-kind rules:
`agents/AGENTS.md` §4. This is the TypeScript CLI
(`@moonshot-ai/kimi-code`, command `kimi`); the Python `kimi-cli` on PyPI
is archived.

## Install

- The package wants Node 22.19 or newer: on Alpine the image's own Node
  must be new enough.
- npm, not Moonshot's `install.sh`, which ships a glibc-only binary and
  edits shell profiles; npm works on every family.

## Launch

- An `sh -c` wrapper: with the phone tools on, before Kimi starts it runs
  our `phonecando-mcp.mjs` and `phonecando-trust.mjs` (below), then execs
  Kimi with its args.
- `KIMI_CODE_HOME=~/.kimi-code-agent`: the agent has a Kimi folder of its
  own, so we can add our MCP server without touching yours
  (`~/.kimi-code`, which a `kimi` you run by hand in a terminal still uses,
  with its own sign-in).
- `resume` adds `--continue`; with no chat for the folder Kimi starts a
  new one.
- No `prompt`, so the TUI takes no scheduled task (ACP mode runs them,
  below): it takes no first prompt (2.6.1
  `apps/kimi-code/src/cli/commands.ts`: an argument is an unknown
  command), and `-p` answers once without the TUI.
- The window title is the chat's title (cut to 32 characters) or `Kimi
  Code`; `surfaces.chatTitle` skips the default.

## State

- Global instructions: `~/.kimi-code-agent/AGENTS.md`, seeded when absent.
- Our config (`config/`: `phonecando-mcp.mjs`, `phonecando-trust.mjs`,
  `AGENTS.md`) is seeded into
  the agent's Kimi folder; a second Kimi Code agent on the machine gets a
  folder of its own (`KIMI_CODE_HOME` in its state folder, our config
  seeded there too).
- `userState`: `~/.kimi-code-agent`.

## ACP mode

`kimi acp` (the ACP registry's `kimi-code` entry; "Run kimi-code as an
Agent Client Protocol (ACP) server over stdio" in `kimi --help`, 2.6.1).

- The launch's `sh -c` wrapper with only the `exec` changed, so
  `phonecando-mcp.mjs` first writes the bridge's current URL into
  `$KIMI_CODE_HOME/mcp.json` (and `phonecando-trust.mjs` checks our rule).
- `tools: config`: Kimi's ACP chats load that `mcp.json` too (2.6.1
  `agent-core-v2` `configLoader.ts` reads `<KIMI_CODE_HOME>/mcp.json`;
  servers from session/new are added on top). With `session` the runner
  would leave the bridge out of the env, so the `phonecando` entry the
  last start wrote there would have no token.
- No `options`: its ACP chats start in `default`, which asks.
- `chat`: `--session <id>` (`-S`, "With ID: resume that session"),
  appended.
- So Kimi can run scheduled tasks, and an idle agent in ACP mode gets a
  waking message as a prompt; while it works, messages still wait (no
  hooks of ours).
- PC trial (2026-11-13, 2.6.1, a fake model): full turns, tools over HTTP
  MCP from session/new, session/list, back-to-back prompts, and
  session/load after a restart; chats in the Kimi folder's `sessions/`.
- Owed: the bridge from `mcp.json` in ACP mode, resume by id, and a phone
  check.

## Events

No hooks of ours (Messages, below). Kimi sends the OSC 7501 support query and
reports once the runner answers; the usual map. Its subagents report as
child records (`id=agent-…`); only their `blocked` counts. Its own
notifications go out only while the terminal reports it is not focused.

## Phone tools

`phonecando-mcp.mjs` puts a `phonecando` server into the agent's
`$KIMI_CODE_HOME/mcp.json` before each start, keeping your other servers:
Kimi reads no variables in `mcp.json`, so the bridge's URL (its port can
change) is written each time, while the token stays in the environment,
named by `bearerTokenEnvVar`.

Our tools never ask, since the phone-control lock is their check:
`phonecando-trust.mjs` appends one rule to the agent's
`$KIMI_CODE_HOME/config.toml`, `[[permission.rules]]` with `decision =
"allow"` and `pattern = "mcp__phonecando__*"` (Kimi names an MCP tool
`mcp__<server>__<tool>` and matches the pattern as a glob, in every
permission mode; 2.6.3 `docs/en/customization/mcp.md`,
`permissionRules/matchesRule.ts`, `permissionPolicyService.ts`). Kimi takes
permission rules from no other file, so this is the one thing we add
there: only when the file names that pattern nowhere yet, keeping the rest
of it as it is, and never when you set `permission.rules` in a form an
appended table would clash with (`rules = [...]`, `permission = {...}`).
Your own `deny` and `ask` rules still come first; its shell and file tools
still ask. A missing file gets the rule alone, and Kimi fills in the rest
as for no file (`configService.ts`: a section the file lacks takes its
default).

## Messages

Pull only (no `inbox` block): Kimi's hooks live in the same `config.toml`
as its sign-in and providers, where we add only the phone tools' one rule
(Phone tools, above) and no hooks; other agents' messages wait
until Kimi calls `agents_inbox`, which its seeded `AGENTS.md` asks it to
do when a task starts, and every phone tool's result says how many are
unread.

## Local models

Over `openai-chat`: Kimi's `KIMI_MODEL_*` variables (provider type
`openai`, the server's `/v1`, the model, its key and context).
