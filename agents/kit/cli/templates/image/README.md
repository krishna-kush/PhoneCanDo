# __ID__

An image agent kind: installed into its machine's Linux image when the
agent is made, and run inside proot (full and lite only; play has no
Linux).

TODO before this kind ships:

- `agent.json`: label, version, licence (`spdx`, `source`, and whether we
  redistribute anything; installing from the vendor means we do not).
- `agent.json` `install`: the runtimes it needs (`requires.runtimes`, e.g.
  `node>=22`, from `agents/runtimes/`), the packages per family and the
  steps (POSIX sh, HOME the image home, each its own subshell). A failed
  step runs again (`install.retries`, default 2 more times), so each must
  be safe to run more than once; `update` and `versionCheck` beside it.
- `engine`: how its TUI starts.
- `instructions`: its global instructions file in HOME, if it has one;
  `state` when it can keep an agent's sign-in, settings, chats and
  instructions in a folder of its own, so a second agent of it can share
  a machine; `userState`, where it keeps them by default, never its
  install (`agents/AGENTS.md` §4).
- `inbox`, when it has hooks or an extension that can hand other agents'
  messages to it: the hook events whose hook runs
  `sh ~/.phonecando/bin/phonecando-inbox <Event>`, each with what it
  prints, and `wake` if an idle agent of it can be woken (`agents/AGENTS.md`
  §4, Messages from other agents). Without one it only reads them when it
  calls `agents_inbox`.
