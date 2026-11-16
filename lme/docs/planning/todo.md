# LME — open work

What is built is described in `lme/docs/README.md`,
`app/docs/modules/models.md` and `app/docs/modules/runner.md` → Local
model servers.

## Android module `app/modules/phonecando-models/`

- [x] Built: models dir and jobs, import, `DeviceInfo`, the token in
      Keystore, `libllama-server.so` in every channel, error codes.
- [x] Device check: import through the picker, RAM verdicts.
- [ ] Device check: a download that survives airplane mode and an app
      restart; a gated repository with and without a token.

## Runner model servers

- [x] Built: one model server per model, several at once (the user's
      optional cap in Settings; the runner's memory guard looks after
      RAM), started and stopped with its agents; the one join
      (`LocalModelBinding`).
- [x] Several system messages on Qwen3.5: our fold patch
      (`lme/docs/README.md` → The system-message fold).
- [x] Claude Code's tool search on Qwen3.5 (error 500, "Unexpected item
      type in content."): the same fallback writes tool references as
      text; checked against the pinned Qwen3.5 and LFM3 templates. Phone
      check owed.
- [x] Device checks on Qwen3.5-0.8B: opencode, Claude Code (patched
      server), Qwen Code and Aider through the Model section.
- [x] Keep a chat across server restarts: built 2026-11-16 with chats on
      storage (`--slot-save-path`, the runner's go-between): a planned stop
      saves the slot's chat, and the chat's next request loads it back. On
      the phone a restore took under 0.4 s where reading the same 15k
      tokens took 345 s.
- [ ] Warm a new chat once after load (the agent's system prompt). A new
      chat has no saved file of its own, so its first request still reads
      the whole prompt.
- [ ] Safety net: `stage.sh` compares the staged `INPUTS` with this tree's
      digest (pins, script, patches) and says when the staged lib is out
      of date, as `lre/proot/ensure.sh` does for proot.
- [x] Claude Code refuses a 16k context ("Prompt is too long"; its own
      prompt is 13-20k): automatic now starts at 32k whenever the budget
      holds it, up to 64k, and keeps 16% of RAM plus 512 MiB free (the
      memory guard's ok line and the agent's engine).
- [ ] Device check: automatic on the 0.8B stays at 32-64k across starts,
      and the phone stays out of the memory guard's warning; the server's
      resident size against the plan's `totalBytes` (measured since
      2026-11-16, compute buffer and repacked weights included).
- [x] Device check: a hybrid model (Qwen3.5 0.8B) with `--ctx-checkpoints
      4` and chats on storage, two chats taking turns (2026-11-16, MODEL-13):
      the chat came back from storage 1.3 s after the send with its 3
      checkpoints, the turn read only what was added since (1,377 tokens,
      14,398 before), and no "exceeds cache size limit" line. Its Fail in
      `phone-tests/status.md` is against the case's old "a few dozen
      tokens" (the round's review note).
- [ ] Device check: the same on a phone short of storage, where chats stay
      in the RAM prompt cache (`--slot-prompt-similarity 0`, room for two
      saved prompts).
- [ ] Device check: answers with an 8-bit KV cache (half-size notes), on a
      model that serves with them here (MODEL-12; the 4B is now measured
      too big for our 8 GB phone, see Open questions).
- [ ] A per-kind least context (Claude Code 32k) if a kind ever needs
      more than the 32k automatic gives.
- [ ] Codex on a local model: its `models` block waits for the first CI
      run of `local-models.yml`.
- [ ] Device check: later replies, Qwen3.5 4B, RAM and heat over a long
      run.

## Local-model check in CI

- [x] `local-models.yml` (`docs/guides/testing.md` → CI workflows). A kind
      gets a `models` block only when it passes with both test models;
      kinds that take a model only from their own config get none. pi has
      none yet (its extension would need `pi.registerProvider`).
- [ ] The first CI runs: watch for the 0.8B model wandering into tool
      calls until the time limit; if it does, move the Qwen family's test
      model up to Qwen3.5 4B.

## UI

- [x] Built: Models page, Model section, Model step at agent creation,
      prompt-reading progress, the Memory setting (RAM share, then
      Advanced: context, note size, saved chats, snapshots, CPU threads),
      the Detailed log switch, our own size filter.
- [x] Device checks (2026-11-15/16): the Memory page's live line and
      Advanced, a save and setting it back, the measured line, and the
      Detailed log switch, off with its note (MODEL-03, 05, 07, 15).
- [x] Device checks: the Model step, the reading line on a cold prompt,
      the size filter, row sizes and the Filters sheet.
- [ ] Device check: the Filters sheet at the largest font size.
- [ ] Device check: the Hugging Face list's download sizes ("1.6–61.1 GB")
      fill in as rows scroll into view and only then (logcat or a proxy:
      one `revision/main?blobs=true` per repository, none for rows never
      reached); opening a sized repository and starting a download from it
      ask the Hub nothing more; split models list every part with its size.
- [ ] Device check: the Context slider (Memory → Advanced) in the scroll
      view, and a save that restarts a running agent (MODEL-09).

## Payload and CI

- [x] Built and run on the phone; staged by `android.yml`; in the CI path
      lists, the licence notices and `docs/telemetry.md`.

## Waiting on llama.cpp: what to change when it gives better tools

Found 2026-11-15/16 while fixing prompt re-reads (research notes and the
phone trial's logs: `phone-tests/`, and the `--fit` and storage findings
below). Each item says what llama.cpp lacks today, what we built instead,
and what to do once it lands. Check them at every pin bump.

- [ ] **`--fit` leaves out repacked weights on CPU-only builds.** Its dry
  run is good (about 0.5 s on the phone, compute buffer included), but it
  counts a buffer only if it is a host type or on one of the model's
  devices. CPU_REPACK and CPU_KLEIDIAI are neither on a CPU-only build, so
  they are skipped (`common/fit.cpp:89-109` at v0.9.0, `90-110` at v1.0.0;
  master's file is the same). On Qwen3.5 0.8B with q8_0 notes that was
  549 MiB (KleidiAI 290 + repack 259): it projected 1436 MiB, the phone used
  about 1985. Its own printed table lists those rows, then leaves them out of
  the total. No upstream issue or PR yet: report it (a fix is about 4 lines:
  count any CPU-device buffer as host memory).
  - Until then (built 2026-11-16): we read llama.cpp's own per-buffer
    sizes (the `--fit on` dry run with our own flags and `--log-jsonl`, its
    `fit_memory_breakdown` rows: Host, CPU_REPACK, CPU_KLEIDIAI; host's
    `FitBreakdown`, the runner's `ModelMeasurer`) and the planner counts
    them (`ServerMemory`). The repacked size depends on the phone's CPU
    (which kernels apply), so a measurement is kept per model with the
    phone and server build it was taken on (`<id>/.memory.json`); a start
    measures again only when its plan's context or note size differs, and
    the runner measures new models in the background. Before that, a safe
    estimate (every weight twice). Phone check 2026-11-16 (MODEL-15): each
    dry run took about 0.7 s, and the 4B copied 2,778 MiB (the 0.8B 549).
    Owed: the E2B and 9B's real numbers, then the phone sizes in
    `suggested.json` from them (they still count files and state alone).
  - Once fixed: let llama.cpp pick the context (`-c 0 --fit on --fit-ctx
    32768 --fit-target <MiB to leave free>`) and read the chosen `n_ctx`
    from `/props`, so our planner only sets the margin.
- [ ] **Free memory on Android reads as total RAM.** `ggml-cpu.cpp:377` sets
  free = total on Linux and Android, on purpose (#15834), at v0.9.0, v1.0.0
  and master. No flag or env var changes it. We keep computing the margin
  from Android's own available memory; `--fit-target` is the only lever.
- [ ] **No memory endpoint.** `/props`, `/metrics` and `/slots` report no
  memory. PR #26130 (open, with conflicts) adds `GET /memory` with the
  repacked rows. Once merged: read memory from it instead of a dry run
  before each new plan (the real server's log stays plain text: its load
  lines carry no sizes below trace level, and `--log-jsonl` would turn
  every line, the Server log page's too, into JSON).
- [ ] **No automatic saving of chats to disk in the server.** Today only
  `--slot-save-path` plus `POST /slots/{id}?action=save|restore`, driven by
  someone. Built 2026-11-16: a go-between in the runner
  (`models/chats/ChatRelay`) saves the live chat to storage before another
  chat takes the slot and restores the right one, keyed by each chat's
  head; with it the server gets no RAM prompt cache. Phone trial, 0.8B: a
  15k-token chat saved in 0.38 s (159 MB file), restored in 0.16-0.37 s,
  then only the new 19 tokens were read (0.9 s) instead of 345 s. Two
  chats taking turns, 2026-11-16 (MODEL-13): the chat came back 1.3 s
  after the send, and the turn read 1,377 tokens instead of 14,398. Owed:
  a cold-flash restore (the trial's were likely from the page cache).
  PR #32303 (open, experimental, by a maintainer)
  adds `--cache-disk PATH` and `--cache-disk-max-size` (needs `--cache-ram`;
  saves a prompt when the RAM cache drops it, and at shutdown or sleep;
  restores by longest shared prefix, checkpoints included). Once merged and
  stable: switch to it, drop our go-between, and stop model servers with
  SIGTERM so it can save (a SIGKILL loses what was only in RAM).
- [ ] **Repacked weights keep their file pages resident with mmap**
  (#16761; fix PR #24156 open, not in v1.0.0 or master). Until then
  `--load-mode none` avoids it at a slower load; check on the phone first.
- [ ] **`--no-repack` (`-nr`)** turns off KleidiAI and CPU repacking: about
  550 MiB less on the 0.8B, but slower (upstream numbers on an Apple M4 Max:
  repacking about doubles prompt speed and adds 10-15% to generation). Needs
  a phone speed test before we offer it, e.g. under Memory → Advanced for
  tight phones.
- [ ] **llama.cpp v1.0.0** (2026-11-13): checkpoints shared between a slot
  and its saved copies (#30137, less RAM per saved chat). Our two patches
  apply with line offsets only, and no flag we use is gone. Bump as its own
  step (rebuild, then a phone check).
- [ ] **Master after v1.0.0:** a new slot scheduler and a running hash of
  each prompt (#32154, merged 2026-11-15). Re-check slot selection and
  `--slot-prompt-similarity 0` when we take it; two slots on one shared KV
  pool (`-np 2 --kv-unified --no-cache-idle-slots`) may then work for
  chats that take turns without any saving.
- [ ] **Hybrid-model checkpoints:** PR #25592 (open) keeps early checkpoints;
  issue #24055 still shows a full re-read after an edit mid-prompt on
  Qwen3.5 0.8B. Once merged: re-check how much a new user message re-reads.
- [ ] **Our two patches** (`patches/0001-fold-system-messages`,
  `0002-slot-prompt-total`) are still needed at v1.0.0: Qwen3.5's template
  fails without the fold, and `/slots` has no prompt total. Re-check both at
  every bump.

## Open questions

- [ ] **Qwen3.5 4B on 8 GB phones (undecided, not solved on purpose).** Since
  2026-11-16 the plan counts the repacked weight copies the CPU kernels make
  (measured by llama.cpp's own dry run). Measured on our 8 GB test phone on
  2026-11-16 (MODEL-15): the 4B copied 2,778 MiB, so even at 16k with
  half-size notes its page says "Needs 4.1 GB of RAM; this phone can spare
  3.9 GB" and "Too big for this phone": our default model is refused on
  8 GB phones. Its Suggested card still says it fits (3.6 GB: files and
  state alone, as `suggested.json` counts), and so does the website.
  Options: accept it (the 4B becomes a 12 GB-phone model; update
  `suggested.json` and the site from the phone's numbers, and 8 GB phones
  default to a smaller model); `--no-repack` on tight phones (saves the
  copies but is slower; needs a phone speed test first, see Waiting on
  llama.cpp); or a bigger budget than half the RAM for big models (risks the
  memory guard and Android killing apps). Measure the E2B and 9B on a phone
  too; `suggested.json`'s sizes should follow those numbers.
- [ ] Qwen3.5 9B: files plus a 16k KV cache are 6.2 GB, so the 50% budget
      needs a phone reporting 12.4 GB; most 12 GB phones report less.
      Label it "16 GB phones", or loosen the budget for it? A chosen
      context may pass the budget, so it can run at 16k there with the
      warning.
- [x] The compute buffer at a large context (the 0.8B at 256k), which the
      gate did not count: it does now, from the server's own dry run at the
      context a start plans (`FitBreakdown`). More context on small phones
      comes from half-size notes (`--cache-type-k/v q8_0`).
- [ ] Device numbers, for a phone short of storage (chats then stay in the
      RAM prompt cache): does a smaller chosen context with room for more
      saved prompts pay?
- [ ] A second build for ARMv8.6 (`+i8mm`), picked at run time from
      `cpuFeatures`, if device numbers show it pays.
