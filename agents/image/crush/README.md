# crush

Charm's Crush, downloaded from its GitHub release and run as a TUI in the
agent's machine. Shared image-kind rules: `agents/AGENTS.md` §4. Licence
FSL-1.1-MIT: we only point the phone at Charm's release and never ship or
host Crush (`NOTICE.md`).

## Install

Crush is one static Go binary, so every family works, Alpine included.
The steps read the latest version from the `releases/latest` redirect,
check the tarball against the release's `checksums.txt`, and move `crush`
into `~/.local/bin` (written beside it, then renamed over the old one).
That is the release install Charm documents; the npm package only wraps
the same download in Node.

## Launch

- Crush checks GitHub for a newer release on each start and shows a
  notice. There is no switch for it, and it never updates itself.
- `resume` adds `--continue`, the newest chat.
- No `prompt`, so it cannot run scheduled tasks: the TUI takes no first
  prompt (v0.101.0 `internal/cmd/root.go`: `crush <text>` is an unknown
  command), and `crush run` answers once without the TUI.
- No `chatTitle`: the window title is `crush <folder>`.

## State

- Global instructions: `~/.config/crush/CRUSH.md`.
- One Crush agent per machine: its per-project `.crush` lock would need a
  data folder per agent, which we cannot template.
- `userState`: `~/.config/crush` and `~/.local/share/crush`.

## Events

No hooks (see Phone tools). OSC 7501, unprompted, with the usual map. Its
own notifications (`option notifications osc` or `bell`) stay off: it
turns on focus reports only when the terminal answers its mode query
(DECRQM 1004), which ours does not.

## Phone tools

None: Crush reads its config (`crushrc`, a Bash file with `hook add …` and
`mcp add …`) only from the working folder and `$XDG_CONFIG_HOME/crush/`,
with no flag or variable for one more file.

## Messages

None: with no phone tools (above) it can neither read nor send other
agents' messages, so a message to it is refused with that reason, and the
app shows it as "can't read messages".

## Local models

None: Crush takes a custom model server only from its config file
(`providers`).

## Sign-in

Besides an API key, `crush login` signs in to Charm Hyper or GitHub
Copilot with a device code, or to OpenAI with a browser.
