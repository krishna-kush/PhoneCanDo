# gemini-cli

An image kind: Google's Gemini CLI, installed into the agent's Linux
machine from npm on our `node` runtime and run there as a TUI (full and
lite; play has no Linux). Licence and terms: `NOTICE.md`. It is all data:
`agent.json` and one settings file, `config/settings.json`.

Checked with Gemini CLI 0.67.0 on our test phone (Moto g96, Default
image): the install (about 5 min; an npm `ECONNRESET` was retried by
itself), the system settings loading, working/waiting/finished alerts
through the hooks, the `mobile_*` tools over MCP and `--resume latest`
after an app restart. Not checked on a phone yet: an Alpine machine.

## Install and update

- Runtime `node>=20` (the package's `engines`); the `node` plugin gives 22.
- Packages per family: `bash` (Gemini runs its shell tool and its hooks
  with it), `git` and `ripgrep` (the agent's own tools; the npm package
  ships no `rg`, so Gemini takes the system one from `/usr/bin`) and
  `ca-certificates` (git over https).
- Step: `npm install -g --prefix "$HOME/.local" @google/gemini-cli@latest`,
  which links `/root/.local/bin/gemini` to the bundle's `gemini.js`
  (`#!/usr/bin/env node`; node is first on PATH). Its optional native
  parts need no compiler: keytar carries its own arm64 and musl builds,
  `@lydell/node-pty` has a linux-arm64 (glibc) one, and npm drops
  `node-pty`, which builds only where a compiler is. Without a PTY module
  Gemini runs shell commands without one. Update runs the same command.
- Version check: `gemini --version` prints `0.67.0`; the pattern takes the
  first line that starts with a version, so a Node warning above it does
  no harm.

## Launch

`/root/.local/bin/gemini` in `{{projectDir}}`, with
`GEMINI_CLI_SYSTEM_SETTINGS_PATH=/root/.phonecando/gemini/settings.json`.
The runner seeds `config/` there on every start (`config.into`). System
settings win over user and project ones, and `mcpServers` and `hooks`
merge across them, so `~/.gemini/settings.json` stays yours.

Gemini reads a system settings file only when the file and every folder
above it are owned by root and not writable by group or others. Otherwise
it shows `Security Warning: Skipping system settings file ...` and runs
without our hooks and tools. proot's fake root shows our files as root's.

- `hooks`: `BeforeAgent` working, `Notification` (a tool waits for your
  approval) waiting, `AfterAgent` finished. Each runs
  `sh /root/.phonecando/bin/phonecando-event <Event>` with the hook JSON
  on stdin, which Gemini closes at once. It prints nothing and never
  exits 2 (2 blocks the turn). Gemini briefly shows `Executing Hook:
  phonecando-working`; no setting hides hooks that come from settings
  files. An API error still ends with `AfterAgent` (finished, not
  failed). Esc fires nothing, so the runner's stale-run rule ends the run.
  The quota and model-fallback dialogs fire no hook.
- `mcpServers.phonecando`: `httpUrl` `${PHONECANDO_BRIDGE_URL}/mcp` with
  `Authorization: Bearer ${PHONECANDO_BRIDGE_TOKEN}`. Gemini expands both
  from its environment when it loads settings, so the token is never on
  disk. Each phone tool asks for approval like any tool. While the bridge
  is down Gemini says `MCP issues detected. Run /mcp list for status.`
- `general.enableAutoUpdate` and `enableAutoUpdateNotification` off:
  Gemini's own update runs a plain `npm install -g`, which lands in Node's
  prefix, not `~/.local`; "Update agent" does it. With both off Gemini
  never asks the registry.
- `ui.showHomeDirectoryWarning` off: the agent always runs in HOME.
- `BROWSER` is the runner's `phonecando-open`, but Gemini opens no browser
  on Linux without `DISPLAY` (see Sign-in).

Ready after its first output and 500 ms of quiet; 180 s for the first
output, since Gemini starts a second Node (a child with a larger heap)
under proot. That child restarts after a trust change while the parent
stays, so the engine lives on (`GEMINI_CLI_NO_RELAUNCH` stays unset).
Idle after 120 s with no output and no event.

`resume` adds `--resume latest`. With no saved chat Gemini says `No
previous sessions found for this project.` and starts a new one.

No `chatTitle`: the window title is only the state and the folder
(`◇  Ready (home)`, `✦  Working… (home)`, `✋  Action Required (home)`).

## First start and sign-in

1. `Do you trust the files in this folder?`: pick `1. Trust folder`.
   Gemini restarts itself and remembers it (`~/.gemini/trustedFolders.json`;
   `/permissions` changes it). An untrusted folder runs no hooks and no MCP
   servers from any settings file: no events and no phone tools.
2. `How would you like to authenticate`:
   - `Use Gemini API Key`, then paste the key at `Paste your API key here`.
     Gemini keeps it in `~/.gemini/gemini-credentials.json` (encrypted; the
     machine has no keychain). A `GEMINI_API_KEY=<key>` line in
     `~/.gemini/.env` works too: the box comes prefilled, press Enter.
   - `Sign in with Google`: with no display Gemini prints a link and waits
     at `Enter the authorization code:`. The link is plain text in our
     terminal; open it in a browser, sign in, and paste the code the page
     shows.

A free API key has no `gemini-3.1-pro-preview`, which `Auto` uses for the
main requests. Pick Flash in `/model`, or add `GEMINI_MODEL=flash` to
`~/.gemini/.env` (then `gemini-3.8-flash` answers). We never take part in
signing in.

If Gemini ever shows `Skipping system settings file`, run
`stat -c '%u %a %n' / /root /root/.phonecando /root/.phonecando/gemini`
in the Linux shell: it says which folder is not root's or is group/other
writable.
