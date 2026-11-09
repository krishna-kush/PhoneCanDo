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
