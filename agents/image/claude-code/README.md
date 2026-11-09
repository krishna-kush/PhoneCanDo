# claude-code

An image kind: Anthropic's Claude Code, installed into the agent's Linux
machine from Anthropic's installer and run there as a TUI (full and lite;
play has no Linux). Licence and terms: `NOTICE.md`. Everything below is
data in `agent.json`; there is no code and no runtime plugin (the installer
ships one native binary).

## Install and update

- Packages per family: `bash` (the installer and Claude's shell),
  `curl` and `ca-certificates` (the download), `git` and `ripgrep` (the
  agent's own tools). Alpine also needs `libgcc` and `libstdc++` for the
  musl build. dnf gets no `curl`: Fedora images ship `curl-minimal`, which
  conflicts with the `curl` package.
- Steps: download `https://claude.ai/install.sh`, then run it with bash.
  Downloading first (not `curl | bash`) makes a failed download fail the
  step, and a failed step runs again (the default `install.retries`, two
  more tries 5 s and 10 s later), which rides out a dropped DNS lookup on
  mobile data; every step is safe to rerun. The installer puts the binary
  under `/root/.local/share/claude/versions/` and the `claude` launcher at
  `/root/.local/bin/claude`. Update runs the same two steps.
- Version check: `/root/.local/bin/claude --version` prints
  `2.1.319 (Claude Code)`.

## Launch

`/root/.local/bin/claude` in `{{projectDir}}`, with:

- `--settings '<json>'`: our hooks, merged with your own settings (hooks
  from every settings level all run). Each hook runs
  `sh /root/.phonecando/bin/phonecando-event <Event>` with Claude's hook
  JSON on stdin, which writes the event to the runner's events file.
  `events[].hook.map` turns them into engine events:
  `UserPromptSubmit` working, `Notification` (permission and MCP input
  prompts only) waiting, `Stop` and `SessionEnd` finished, `StopFailure`
  (an API error ended the turn) failed. An interrupted turn fires no
  `Stop`.
- `--mcp-config '<json>'`: the phone tools, an HTTP MCP server at
  `${PHONECANDO_BRIDGE_URL}/mcp` with `Bearer ${PHONECANDO_BRIDGE_TOKEN}`.
  Claude Code expands both from its environment, so the token is never in
  argv or on disk. While the bridge is down neither variable is set and
  the server fails to connect.
- Env: `DISABLE_AUTOUPDATER=1` (no background download of a new binary;
  "Update agent" does it), `USE_BUILTIN_RIPGREP=0` (the system `rg` on
  every family, which Alpine needs), and
  `BROWSER=/root/.phonecando/bin/phonecando-open`, so a sign-in link
  becomes the phone's "open this link" prompt.

Ready after its first output and 500 ms of quiet (120 s for the first
output: a cold start under proot is slow). Idle after 120 s with no output
and no event.

The window title is `<glyph> <title>`: `✳` idle, `◐`/`◑` while working,
and `Claude Code` until the chat has a title. `surfaces.chatTitle` takes
the title after the glyph and skips the default.

No `resume`: `claude --continue` exits 1 ("No conversation found to
continue") when the folder has no saved chat yet, so an agent stopped
before its first prompt would then die on every start. A fresh start can
still pick up an old chat with `/resume`.

## Sign-in

Claude Code asks on first start (or run `/login`). Its link goes through
`BROWSER` to the phone; the sign-in page returns to Claude's loopback
callback, which works because the machine shares the phone's loopback. If
the page shows a code instead, paste it at the `Paste code here` prompt.
An API key works too (`ANTHROPIC_API_KEY` in the `env` block of
`~/.claude/settings.json`). We never take part in signing in.
