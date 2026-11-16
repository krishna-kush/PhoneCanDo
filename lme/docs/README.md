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
  under `<id>/`, with what the model's server measured of itself on this
  phone (`<id>/.memory.json`) and the host's dir for its chats on storage
  (`<id>/.chats/`), both gone with the model. Downloads resume a `.part` with `Range` and are verified
  by size and sha256 before the rename; imports check the magic first and
  the header last; a startup sweep clears what a killed job left.
- `host`: `ModelRuntime` is the seam. `LlamaCppRuntime.plan` checks the
  device and the RAM gate, then plans the server (flags and why in its
  KDoc); `serve` is the bare command without those checks; `measure` is
  the dry run that measures a server before its start (`FitBreakdown`). `Readiness`
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
`host/context/`; the plan in `LlamaCppRuntime.contextPlan`, which takes
the user's per-model choices (`ServeChoices` on the model's record, the
app's Memory setting) as inputs.

- **Offered** from a 6 GB phone, with a warning below 8 GB (by marketed
  size; phones report less).
- **Budget**: the model's share of the phone's RAM: half (Normal), about a
  third (Less) or two thirds (More), never the share the memory guard
  keeps free. A model is refused when what its server holds plus one
  prompt's state at the planned context pass it (`PromptState`: its KV
  cache, the recurrent state of one sequence, and its context
  checkpoints).
- **What the server holds** (`ServerMemory`): its weights and its compute
  buffer. llama.cpp reads some weights in place from the file (pages
  Android may reclaim, which every token reads) and copies the rest into
  its CPU kernels' own layouts as it loads (CPU_REPACK and CPU_KLEIDIAI:
  anonymous memory, which depends on the phone's CPU); the file pages of
  what it copied are no longer read. The host measures it on each phone
  (`MeasuredMemory`, from the server's own `--fit` dry run with our flags
  and `--log-jsonl`: `FitBreakdown` reads its `fit_memory_breakdown`
  line, kept per model with the phone and server build it was taken on)
  and plans with that; the compute buffer grows with the context, so past
  the context measured it is counted in step (more than it grows). Before
  a model's first measurement on a phone, an estimate: every weight twice
  (the whole file read in place, and all of it copied:
  `RamRules.COPIED_WEIGHTS_PERCENT`) and a compute buffer of 64 MiB or an
  eighth of the files, plus 2 KiB a token. On our test phone the 0.8B at
  32k with 8-bit notes measured 202 MiB read in place, 549 MiB copied and
  67 MiB of compute (1,118 MiB with its state, where files and state alone
  counted 808); the estimate is safe on that. `heldBytes`, what a running
  server takes from free memory, is all but the pages it reads in place.
  The phone sizes `suggested.json` publishes still count the files and
  the state alone (`ServerMemory.filesOnly`), until a phone has measured
  each suggestion.
- **Recurrent state** (`gguf`'s `RecurrentState`): what the recurrent
  layers of a hybrid or recurrent model keep per sequence, whatever the
  context, read from the header as llama.cpp sizes it (`ssm.*`,
  `wkv.head_size`, `shortconv.l_cache`, `kda.head_dim`), in f32: 50.25 MiB
  on Qwen3.5 4B and 9B, 19.3 MiB on the 0.8B.
- **Context checkpoints**: a model with recurrent or sliding-window layers
  cannot roll its state back to an earlier token, so the server keeps
  copies of that part (the recurrent state and the window's KV cache) to
  reuse a prompt that changed near its end. We pass `--ctx-checkpoints 4`
  (`RamRules.CONTEXT_CHECKPOINTS`, 2 to 8 by choice; the pinned server's
  default, 32, would take 1.6 GiB on Qwen3.5 4B), only for such models: a
  dense model gets none. A header that names a window but no pattern of
  windowed layers gets llama.cpp's own period for its architecture
  (`gguf`'s `SwaPatterns`: Gemma 2 and 3, gpt-oss, Cohere 2, OLMo 2 and
  others), else every layer counts both as full and as windowed, so we
  never count less than the server keeps.
- **KV cache size**: f16, unless the budget does not hold the model at 32k
  (or its whole trained context when less) with f16, or, with chats in
  RAM, f16 leaves no room for one saved chat where 8-bit would
  (`ServePlanner`): then 8-bit
  (`--cache-type-k/v q8_0`, half the size), when every head is a whole
  number of 32-value blocks (`KvCacheShape.quantizable`; the server refuses
  a q8_0 cache otherwise, and turns flash attention on for it by itself).
  The user may pick full or half instead.
- **Spare now**: the budget, bounded by the memory free (`availMem`) less
  what we keep free: 16% of total RAM (where the runner's memory guard is
  back at ok: its 12% warning line plus 4%) and 512 MiB for the agent's
  own engine. So a model, prompt cache included, never starts the guard's
  countdown by itself. It sizes the automatic context and the prompt
  cache, never a verdict.
- **Automatic context**: the most whole 1024-token steps whose server
  (weights and compute buffer) plus one prompt's state, with room left
  for the saved prompts when chats stay in RAM, fit the spare
  memory, up to 64k (a phone CPU reads a few thousand tokens a minute, so
  a session never fills more) or the trained context if that is less; at
  least 32k whenever the budget holds it, whatever is free (agents' own
  prompts run 13-20k tokens, so at 16k they cannot work; short of memory,
  the guard stops idle agents first); never below 16k or the trained
  context if that is less.
- **Chosen context** (per model, 16k to the trained context): may pass the
  budget, with a warning, never the phone's RAM.
- **Prompt cache** (`--cache-ram`, MiB), only when chats cannot go to
  storage (below), in whole prompt states: room for
  `RamRules.CACHED_PROMPTS` (2, 0 to 3 by choice) besides the slot's, when
  what the spare memory leaves after files and the slot's state holds
  them; else what is left. With `--slot-prompt-similarity 0` every request
  saves the slot's prompt there and loads the best one saved (a copy,
  under a second), so an agent and its sub-agent taking turns on the one
  slot each get their own prompt back; the server saves a prompt with its
  checkpoints, and skips one bigger than the whole cache. A saved chat
  counts as a prompt state at half the context
  (`RamRules.SAVED_CHAT_DIVISOR`: a working chat, as Claude Code's 13-20k
  tokens of 32k); the plan says how many fit, and whether free memory
  rather than the RAM share is what limits them (`freeMemoryLimits`). The plan counts it:
  `totalBytes` is what the server holds once it fills. Short of spare
  memory there is no room for a whole prompt, and a turn after another
  prefix took the slot reads its prompt again.
- **Chats on storage** (`StoredChats`): with room for one more chat above
  1 GiB free on storage (`ChatStorage`: the host's dir and what is free
  there), the server gets `--slot-save-path` and no prompt cache
  (`--cache-ram 0`), so the automatic context needs no room for saved
  prompts; the host's go-between saves the one slot to a file before
  another chat takes it and loads the right one back (on our test phone a
  15,000-token chat of the 0.8B: 159 MB saved in 0.38 s, loaded back in
  under 0.4 s, where reading it again took 345 s), at most 4 per model.
  With one slot and no prompt cache `--slot-prompt-similarity 0` changes
  nothing; it stays for a server without storage. Short of storage, or
  once saving failed, chats stay in the prompt cache as above.
- **CPU threads**: the big cores (`Threads`), or the user's count.
- **Detailed log** (per model, off by default): the server logs at trace
  level (`LLAMA_ARG_LOG_VERBOSITY=4`: each request's cache choices, the
  checkpoints it makes and restores) and its slots' debug lines
  (`LLAMA_SERVER_SLOTS_DEBUG=1`: the tokens where a prompt first differs
  from the slot's), prompt text included.

## The system-message fold

`llamacpp/patches/0001-fold-system-messages.patch`. Some agents send more
than one system message: Claude Code puts its environment block in a
`system` message after the user turn, and Codex starts with two
`developer` messages, which the server maps to system. Qwen3.5's template
allows one system message, first. The patch is a fallback in
`common_chat_templates_apply`, where all three wire APIs meet:

- The server first renders the messages as sent, so a template that takes
  them (Gemma 4 and others) renders exactly as before.
- Only when that fails does it render again with the messages made plain
  (tool references as text, then the fold), and that error, if any, is the
  one reported.
- Tool references: Claude Code's tool search answers with `tool_reference`
  parts, the deferred tools it found, and Qwen3.5's template refuses them
  ("Unexpected item type in content."), so a turn failed as soon as the
  model searched. A run of them becomes one text part, "Tool loaded:
  `<name>`" a line per tool. Qwen3.5's template lists every tool up front,
  deferred or not, so the line says all the reference did; a template
  that knows them (LFM3's) renders them as sent and never gets here.
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
