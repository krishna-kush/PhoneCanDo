#!/bin/sh
# PhoneCanDo's launch of Cline: agent.json's engine.launch (the TUI) and
# engine.acp (`launch.sh --acp`). POSIX sh, seeded into
# /root/.phonecando/cline on every start. Then `exec cline "$@"`.
#
# - Cline's folder is $CLINE_DIR (a second Cline agent's own, from
#   agent.json `state.env`), else ~/.cline.
# - The hub: each Cline agent finds only its own hub, through a discovery
#   file in its own folder (CLINE_HUB_DISCOVERY_PATH; the default
#   production.json there is the one a `cline` you run yourself uses).
# - Our plugin (phonecando.js) is copied into <folder>/plugins when it is
#   missing there or is still ours (its `phonecando-managed:` line), never
#   over a file of yours. A copy, not a link: Cline skips linked files.
# - `--phonecando-continue` (agent.json engine.resume) becomes `--id <id>`
#   of the newest chat run in this folder, from `cline history --json`;
#   nothing when there is none. With a prompt too (`-- <prompt>`, a run
#   brought back or a note to go on), `--id` would drop it, so the prompt
#   goes to our plugin instead: written to $PHONECANDO_CLINE_PROMPT (in
#   Cline's folder, with the time), which the plugin's setup sends into
#   that chat as its first message and deletes. With no chat to go back
#   to, the prompt starts a new one as usual.
# - `--acp`: ACP mode, with the provider the TUI last used as
#   CLINE_PROVIDER (ACP mode reads none itself).
set -u

here=${0%/*}
mark='phonecando-managed: cline plugin'
dir=${CLINE_DIR:-$HOME/.cline}
PATH="/root/.local/bin:$PATH"
export PATH
export CLINE_HUB_DISCOVERY_PATH="$dir/data/locks/hub/phonecando.json"
export PHONECANDO_CLINE_PROMPT="$dir/phonecando-prompt.json"

install_plugin() {
  src="$here/phonecando.js"
  plugins="$dir/plugins"
  dst="$plugins/phonecando.js"
  [ -f "$src" ] || return 0
  if [ -e "$dst" ] || [ -L "$dst" ]; then
    # Yours (no mark, a link, a folder): left alone.
    [ -f "$dst" ] && [ ! -L "$dst" ] || return 0
    grep -q "$mark" "$dst" 2>/dev/null || return 0
    cmp -s "$src" "$dst" && return 0
  fi
  mkdir -p "$plugins" || return 0
  # Not a .js name, so Cline never loads the half-written copy.
  tmp="$dst.phonecando-$$"
  if cp "$src" "$tmp" 2>/dev/null; then
    mv -f "$tmp" "$dst" || rm -f "$tmp"
  else
    rm -f "$tmp"
  fi
}

# The newest chat of this folder in `cline history --json` (rows with
# sessionId, cwd, updatedAt; sub-agents left out by Cline).
latest_chat() {
  if command -v timeout >/dev/null 2>&1; then
    rows=$(timeout 30 cline history --json --limit 200 2>/dev/null)
  else
    rows=$(cline history --json --limit 200 2>/dev/null)
  fi
  [ -n "$rows" ] || return 0
  printf '%s' "$rows" | node -e '
let s = "";
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  try {
    const cwd = process.argv[1];
    const at = (r) => Date.parse(r.updatedAt || r.startedAt || "") || 0;
    const rows = JSON.parse(s)
      .filter((r) => r && typeof r.sessionId === "string" && /^[A-Za-z0-9._-]+$/.test(r.sessionId))
      .filter((r) => !r.isSubagent && (r.cwd === cwd || (!r.cwd && r.workspaceRoot === cwd)))
      .sort((a, b) => at(b) - at(a));
    if (rows.length) process.stdout.write(rows[0].sessionId);
  } catch {}
});' "$PWD" 2>/dev/null
}

install_plugin

if [ "${1-}" = --acp ]; then
  shift
  f="$dir/data/settings/providers.json"
  if [ -z "${CLINE_PROVIDER:-}" ] && [ -f "$f" ]; then
    CLINE_PROVIDER=$(node -e 'try{const p=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).lastUsedProvider;if(typeof p==="string"&&/^[\w.:\/@-]+$/.test(p))process.stdout.write(p)}catch(e){}' "$f")
    if [ -n "$CLINE_PROVIDER" ]; then export CLINE_PROVIDER; else unset CLINE_PROVIDER; fi
  fi
  exec cline --acp "$@"
fi

# Hands [prompt] to the plugin: {"at": <ms>, "prompt": "..."}, written
# beside and renamed, so the plugin never reads half of it.
hand_prompt() {
  mkdir -p "$dir" || return 1
  node -e 'const fs=require("fs");const [f,p]=process.argv.slice(1);fs.writeFileSync(f+".tmp",JSON.stringify({at:Date.now(),prompt:p}),{mode:0o600});fs.renameSync(f+".tmp",f)' "$PHONECANDO_CLINE_PROMPT" "$1"
}

if [ "${1-}" = --phonecando-continue ]; then
  shift
  id=$(latest_chat)
  if [ -n "$id" ]; then
    # The args before `--` stay; the one after it is the prompt.
    prompt=
    seen=
    n=$#
    for a in "$@"; do
      if [ -n "$seen" ]; then prompt=$a; continue; fi
      if [ "$a" = -- ]; then seen=1; continue; fi
      set -- "$@" "$a"
    done
    shift "$n"
    if [ -z "$seen" ]; then
      set -- --id "$id" "$@"
    elif [ -n "$prompt" ] && hand_prompt "$prompt"; then
      set -- --id "$id" "$@"
    else
      # The plugin can't get it: the prompt starts a new chat, as before.
      set -- "$@" -- "$prompt"
    fi
  fi
fi

exec cline "$@"
