# LME documentation

`../README.md` is the entry point and `../AGENTS.md` holds the rules; this
file is the map. The app side (the Android module, verdicts on screen,
model dates and sizes) is `app/docs/modules/models.md`.

## How the parts fit

```
HfCatalog ──search, files, variants──▶ host app ──DownloadRequest──▶ ModelStore
                                                  (or a picked file)      │
                                                                          ▼
                                                    models.json + files/models/<id>/
                                                                          │ ModelRecord
DeviceInfo ──────────────────────────────▶ LlamaCppRuntime.plan ◀────────┘
                                                  │ LaunchPlan (argv, env, health URL)
                                                  ▼
                                    runner starts libllama-server.so
                                    Readiness waits for /health
                                                  │
                                                  ▼
                                           ServedEndpoint ──▶ LocalModelBinding ──▶ agent
```

## Modules

- `api`: the shared types (`ModelRecord`, `ModelShape`, `DeviceInfo`,
  `ServedEndpoint`, `WireApi`, `LmeException`, `ModelDates`, ...) and the
  HTTP port (`HttpPort`, our `Redirects` policy, `redactUrl`).
- `gguf`: `GgufReader` reads a GGUF v2/v3 header with hard limits (big
  values are skipped, never kept). `ModelShapes` turns it into a
  `ModelShape`, with the KV cache per token counted as llama.cpp sizes it
  (hybrid layers without a cache, shared-cache layers, sliding windows) and
  the base model the file names (`general.base_model.0.*`).
- `catalog`: `HfCatalog` lists and searches GGUF repositories, pins one to
  a commit, lists its files (sizes, LFS sha256s) and groups them into
  `ModelVariant`s (split parts together, companions such as `mmproj` left
  out). Chat models only is the `conversational` tag minus rerankers and
  embedders (`filters/ChatModels`). We size models ourselves
  (`parameters/ModelSizes`, `filters/ListFill`) and date them from
  `known/KnownModels` and `origin/`; the rules are in
  `app/docs/modules/models.md` → Model dates, Model sizes.
  `Suggested.MODELS` pins our suggestions, best first, from
  `suggested/suggested.json`, which the website reads too, with the phone
  sizes each runs on (`SuggestedRamTest` checks them against the RAM gate).
- `store`: `ModelStore` keeps `models.json` (atomic writes) and the files
  under `<id>/`. Downloads resume a `.part` with `Range` and are verified
  by size and sha256 before the rename; imports check the magic first and
  the header last; a startup sweep clears what a killed job left.
- `host`: `ModelRuntime` is the seam. `LlamaCppRuntime.plan` checks the
  device and the RAM gate, then plans the server (flags and why in its
  KDoc); `serve` is the bare command without those checks. `Readiness`
  waits on `/health`.
- `cli`: lme-cli, for CI only. `plan` prints `serve`'s command for a GGUF
  file (16k context, less when its header says so; the key from a named
  variable, never printed) for CI's local-model check
  (`docs/guides/testing.md` → CI workflows).
- `llamacpp/`: `build.sh` (NDK r28c, API 29, static, 16 KB pages,
  KleidiAI), `verify.sh` (ELF checks), `stage.sh` (into
  `phonecando-models`), `build-host.sh` (the same pins and patches for a
  Linux host, for CI). Both builds apply `patches/` in name order with no
  fuzz and check the fold and the slot's prompt total below are in place.

## RAM gate and context

The numbers live in `RamRules` (`host/ram/`); the context in
`host/context/`.

- **Offered** from a 6 GB phone, with a warning below 8 GB (by marketed
  size; phones report less).
- **Budget**: half the phone's RAM. A model is refused when its files plus
  its KV cache at the planned context pass it.
- **Spare now**: the budget, bounded by the memory free (`availMem`) less
  512 MiB for the agent's own engine and Android. It sizes the automatic
  context and the prompt cache, never a verdict.
- **Automatic context**: the trained context when files plus its KV cache
  fit the spare memory, else the most whole 1024-token steps that do;
  never below 16k (an agent's prompt is about 15k tokens) or the trained
  context if that is less.
- **Chosen context** (per model, 16k to the trained context): may pass the
  budget, with a warning, never the phone's RAM.
- **Prompt cache** (`--cache-ram`, MiB): what is left after files and KV
  cache. Below the trained context that is a few MiB, so the cache is in
  effect off: a request with another prefix (opencode's title request)
  pushes the agent's prompt out of the one slot, and the next turn reads
  it again.

## The system-message fold

`llamacpp/patches/0001-fold-system-messages.patch`. Some agents send more
than one system message: Claude Code puts its environment block in a
`system` message after the user turn, and Codex starts with two
`developer` messages, which the server maps to system. Qwen3.5's template
allows one system message, first. The patch is a fallback in
`common_chat_templates_apply`, where all three wire APIs meet:

- The server first renders the messages as sent, so a template that takes
  them (Gemma 4 and others) renders exactly as before.
- Only when that fails does it render again with the system messages
  folded, and that error, if any, is the one reported.
- The fold: the leading run of system messages becomes one, their text a
  blank line apart. A later one becomes user text ("[System note]" and its
  text) at the end of the user or tool message before it, else at the
  start of the user message after it, else (after an assistant turn) its
  own user message. Blank ones are dropped.

## The slot's prompt total

`llamacpp/patches/0002-slot-prompt-total.patch`. The runner watches a
server read an agent's prompt through `GET /slots` (the agent's engine
sends the request, so it cannot ask for `return_progress`). A slot there
gives the new tokens read so far and those its cache held, but not the
prompt's size: `n_prompt_tokens` is what the slot holds so far. The patch
adds `n_prompt_tokens_total`, the request's whole prompt, the same number
the streamed `prompt_progress` gives as `total`, so the app can show how
far it has read ("33%").

## Planning

- `planning/todo.md`: open work only.
