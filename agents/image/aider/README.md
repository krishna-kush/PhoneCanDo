# aider

Aider, installed from PyPI with uv (our `python` runtime) and run as a TUI
in the agent's machine. Shared image-kind rules: `agents/AGENTS.md` §4.

## Install

- Python 3.12 from the runtime: Aider needs 3.10 to 3.12, and Debian 13's
  own Python is 3.13.
- No Alpine: two of Aider's pinned dependencies (`tree-sitter-language-pack`,
  `tree-sitter`) have no musl wheels for aarch64 and would need a compiler.
- `git` is required: Aider works through git.
- `--with pip` lets Aider add its optional extras. It is the command
  Aider's own installer runs.

## Launch

- `--no-check-update`: Aider's own update would `pip install` into its
  venv.
- It works in `~/projects` without a git repository.
- `resume` adds `--restore-chat-history`, which reloads
  `.aider.chat.history.md`; with none Aider starts fresh.

## State

- No global instructions file (only `--read`).
- One Aider agent per machine: it always merges `~/.aider.conf.yml` and
  `~/.env`.
- `userState`: `~/.aider`.

## Events

`--notifications-command` runs `phonecando-event Ready` instead of the
bell when Aider next waits for you after a model call; `Ready` maps to
finished. Aider has no other hooks, so there is no working or failed
event.

## Phone tools

None: Aider has no MCP support.

## Local models

Over `openai-chat`: `--model openai/<model>`, `OPENAI_API_BASE` and
`OPENAI_API_KEY`. `--no-show-model-warnings` because a local model is
never in Aider's list. Aider exits 0 even after giving up on the server,
so only the CI check's need for a finished answer catches a failure.

## Sign-in

With no key Aider offers OpenRouter's sign-in, which returns to a
localhost port (8484 and up) in the machine.
