# LME — open work

What is built is described in `lme/docs/README.md`,
`app/docs/modules/models.md` and `app/docs/modules/runner.md` → The model
slot.

## Android module `app/modules/phonecando-models/`

- [x] Built: models dir and jobs, import, `DeviceInfo`, the token in
      Keystore, `libllama-server.so` in every channel, error codes.
- [x] Device check: import through the picker, RAM verdicts.
- [ ] Device check: a download that survives airplane mode and an app
      restart; a gated repository with and without a token.

## Runner model slot

- [x] Built: one model server per model, several at once (the user's
      optional cap in Settings; the runner's memory guard looks after
      RAM), started and stopped with its agents; the one join
      (`LocalModelBinding`).
- [x] Several system messages on Qwen3.5: our fold patch
      (`lme/docs/README.md` → The system-message fold).
- [x] Device checks on Qwen3.5-0.8B: opencode, Claude Code (patched
      server), Qwen Code and Aider through the Model section.
- [ ] Warm the prompt cache once after load (the agent's system prompt).
      Across server restarts the pinned server could keep it:
      `--slot-save-path <dir>` enables `POST /slots/0?action=save|restore`.
      The file is as big as the KV cache it holds and helps only while the
      prompt prefix stays the same. Try once a device run shows a restore
      is much faster than a cold read (7.3k tokens: 1 min 35 s on the
      0.8B).
- [ ] Safety net: `stage.sh` compares the staged `INPUTS` with this tree's
      digest (pins, script, patches) and says when the staged lib is out
      of date, as `lre/proot/ensure.sh` does for proot.
- [ ] Claude Code refuses a 16k context ("Prompt is too long"; its own
      prompt is about 12.6k): when automatic falls to the floor, its Model
      section could say so before the start fails.
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
      prompt-reading progress, Context setting, our own size filter.
- [x] Device checks: the Model step, the reading line on a cold prompt,
      the size filter, row sizes and the Filters sheet.
- [ ] Device check: the Filters sheet at the largest font size.
- [ ] Device check: the Context slider in the scroll view, and a save that
      restarts a running agent.

## Payload and CI

- [x] Built and run on the phone; staged by `android.yml`; in the CI path
      lists, the licence notices and `docs/telemetry.md`.

## Open questions

- [ ] Qwen3.5 9B: files plus a 16k KV cache are 6.2 GB, so the 50% budget
      needs a phone reporting 12.4 GB; most 12 GB phones report less.
      Label it "16 GB phones", or loosen the budget for it? A chosen
      context may pass the budget, so it can run at 16k there with the
      warning.
- [ ] Device logs of a large context (the 0.8B at 256k): the `CPU compute
      buffer size` in `model-server-<id>.log`, which the gate does not count.
      More context on small phones would need a quantised KV cache
      (`--cache-type-k q8_0`).
- [ ] Device numbers: does a smaller chosen context with a prompt cache
      pay?
- [ ] A second build for ARMv8.6 (`+i8mm`), picked at run time from
      `cpuFeatures`, if device numbers show it pays.
