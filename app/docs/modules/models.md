# phonecando-models (local models host)

`phonecando-models` (`com.phonecando.models`) is the Expo module that keeps
local models on the phone: GGUF files found on Hugging Face or picked from
the phone, downloaded or copied in and checked by the local model engine
(`lme/`, rules and RAM gate in `lme/docs/README.md`), with each model's RAM
verdict. Apart from the runner's model servers (`runner.md` → Local model
servers), it is the only app module that imports `lme/`, built from source
through `app/plugins/withLmeCompositeBuild.js`.

It packages `libllama-server.so` in every channel, play included: the
binary is in the APK, the weights are data. `lme/llamacpp/stage.sh <build
dir>` stages it into `android/src/main/jniLibs/arm64-v8a/` (gitignored);
Android extracts it to the native-library dir, the one place it lets us
exec from.

## Native API

Typed in `src/engine/models/native.ts` (the seam) and
`src/engine/models/types.ts` (the contract).

- Device: `deviceInfo()`. Supported means a 64-bit ARM phone with the CPU
  features our build needs and 6 GB of RAM or more; otherwise the app
  hides local models.
- On the phone: `listModels()` (each with its context and RAM verdict),
  `listDownloads()` (pending downloads) and `deleteModel(id)` (a model or a
  pending download; a running download is stopped first).
- Context: `contextCheck(modelId, context)` (sync: the verdict for that
  choice) and `setModelContext(modelId, context | null)` (null:
  automatic; rejects `not_enough_memory` past the phone's RAM). A running
  server keeps its context until it starts again.
- Hugging Face: `suggestedModels()` (no network), `searchModels(query,
  filters, limit)` and `nextModelsPage(cursor)` (by default chat models
  most downloaded in the last 30 days; the last 24 pages read are kept for
  the process and forgotten when the token changes), `repoSizes(repos)`
  (each hit's `count`, `smallest` and `largest` download, for the rows that
  came into view), `repoModels(repo)` (at its `main` commit, variants
  smallest first). A repository costs one Hub request, kept for the
  process: repoSizes and repoModels share it, a hit carries `sizes` once it
  is kept, and repoSizes holds back while the Hub's `RateLimit` header says
  fewer than 100 calls are left. After a 429 (the header says none are
  left) nothing goes to the Hub until its window ends: what is kept still
  answers, the rest rejects `rate_limited` at once, and `hubCooldown()`
  (sync) gives the seconds left so the page can say how long and hold Try
  again. Saving or clearing the token forgets that. Every entry carries `ram`, and
  `onPhone` or `downloadId` when it is already here (matched by sha256);
  suggestions, results, a repository and a model on the phone carry
  `dates`.
- Jobs: `startDownload`, `resumeDownload`, `importModel()` (the system
  file picker; null when the user backs out) and `cancelModelJob`. Each
  resolves at once with its `jobId`; progress comes as
  `phonecandoModelsProgress` events, list changes as
  `phonecandoModelsChanged`.
- Token: `hasHfToken()`, `setHfToken(token)`, `clearHfToken()`. The token
  goes in and never comes back out.

A rejection's `code` is a `ModelErrorCode` (`errors/ModelErrorCode.kt`,
exhaustive over `LmeException`); the message is the failure's own line,
never a secret or a signed URL.

## Files

`files/models/` is lme's `ModelLayout`. `ModelsHost` (one per process)
owns the one `ModelStore` over it and sweeps a killed import's leftovers
once, before any job. The runner reads the store through `ModelsHost` and
never writes it.

## Model dates

One line on each model: "Released Mar 2026 · Trained to Aug 2025",
"Released Mar 2026 · Cutoff not published" or "On Hugging Face since Mar
2026" (`ui/models/logic/dates.ts`).

- **Released** only for a model in lme's `KnownModels` (our suggestions'
  originals): the vendor's release month and training-data cutoff from its
  own card, blog or report, each with its source in the code. A cutoff the
  vendor does not publish stays empty; we never guess one.
- **Any other repository**: its original model is the first `base_model`
  of its card, unless the Hub says it is a finetune, merge or adapter of
  it; with none, the repository itself. We show the day that original was
  created on Hugging Face, which can be before its public release.
  `catalog/HubOrigins.kt` looks each original up once, six at a time, and
  keeps the day and size while the process lives; a failed lookup leaves
  no dates.
- **On the phone**: a download keeps its listing's dates in `models.json`,
  so they show offline. An import, or a download that had none, matches
  its GGUF header's `general.base_model.0` against `KnownModels`, with no
  network; otherwise it shows nothing.

## Model sizes

A result's size ("27B", "2B effective") and the Size filter come from
lme's `parameters/ModelSizes`: the repository's name, else its original
model's name, else the original's checkpoint on the Hub (`safetensors`,
same lookup as its dates) when it is stored as floats or is over 10B
(packed integers count low). Gemma's "E2B" counts as 2B, effective.

We never send the Hub's own `num_parameters`: it reads one GGUF file's
header, often a vision projector or a draft model. We match the size
ourselves (`catalog/ListPages.kt`, lme's `filters/ListFill`): a repository
of unknown size is in no bucket, and under a size filter one list or one
More reads up to three Hub pages of 100, stopping once 10 match.

## RAM verdicts

`ram/RamChecks.kt` turns lme's RAM gate into `fits`, `tight` (a 6 GB
phone: close other apps first), `over_budget` (a chosen context takes more
than the phone can spare: it runs, and Android may stop the model
server), `too_big` or `unsupported`, with what the model needs against the
budget. A model on the phone and a suggestion count files plus KV cache at
the context its server would get; automatic never changes a verdict (when
even 16k does not fit, it is `too_big`). A Hugging Face variant counts its
files alone, since its header is not on the phone yet. The screens offer
no download of a model that cannot run here, and the runner refuses to
serve one.

## Context

`context/ModelContexts.kt` reads lme-host's `contextPlan` (the rule:
`lme/docs/README.md` → RAM gate and context).

- **Automatic** (the default). A start decides with the memory free then,
  so it can pick otherwise than the card showed; the Automatic choice says
  so.
- **Chosen**: kept on the model in `models.json` (`context`), for every
  agent on it.
- **On the card**: while its server runs, its own context (the runner
  sets `ModelsHost.serving` to every model it serves, since the server's
  memory would make a new pick look smaller); else what a start would get
  now.

## Jobs

`ModelsHost` runs jobs on its own executor (Expo's async queue is one
thread shared by every module), at most one per download or import
(`jobs/ModelJobs.kt`); a JS reload keeps them running.

- **Download** (`jobs/DownloadOps.kt`): registered in `models.json` first;
  lme fetches each file into its `.part` with `Range` resume, renames it
  only after size and sha256 match, and checks the GGUF header last; the
  fetching, retrying and resuming are our shared `network/` code, the same
  for Linux images. Network trouble, server errors, rate limits (as long as
  `RateLimit`/`Retry-After` ask) and a 401/403 from the CDN retry by
  themselves; with no network a download waits for one without using up
  its tries (network's `RetryPolicy`, `RetryLoop`; online from
  `phonecando-network`'s `NetworkState`). A retry goes on from where its
  hash got to; a Pause cuts even a hanging read and keeps what arrived. A
  download the process or a long outage stopped runs again on the next
  start (network's `ResumeList`); one the user paused waits for Resume.
- **Import** (`jobs/ImportOps.kt`): the picked `content://` file is copied
  in (llama.cpp needs a real path); magic checked on the first bytes, the
  header after the copy; on any failure nothing of it stays.
- **Events** (`jobs/JobReporter.kt`): a few per second; `step` is
  `download`, `verify` (re-reading a resumed `.part`), `import`, `retry`
  or `offline` (waiting for a network).
- **Foreground.** A model is gigabytes, and Android ends a background
  app's process long before such a download is done. A job running while
  the runner's foreground service is down starts it (`ACTION_HOLD`, the
  runner's `jobs/JobsAnchor.kt`, which does the same for Linux jobs); the
  service lists running jobs in its notification and stops 10 s after
  neither an engine nor a job runs.

## The Hugging Face token

`token/HfTokenVault.kt` keeps it encrypted with AES-GCM under an Android
Keystore key (`files/state/hf-token.bin`). Only native code reads it, for
lme's calls to `https://huggingface.co`. It is never logged or returned to
JS; a file the key cannot open is deleted.

## Screens

`src/ui/models/`: the Models page (Env → Models, on every channel where
the phone can run local models): In progress, On this phone (Stop while
it is loaded, which stops the agents on it first and asks before when
there are any; Context; Delete, refused while an agent is set to the
model; Import), Suggested,
Hugging Face with a repository's variants, and the token. The list opens
on the most downloaded chat models; typing searches after a pause. Sort
and Filters (a sheet: Size, License, chat models only) are two half-width
buttons with a wrapping line of the filters that are on; nothing scrolls
sideways (`parts/HfFilters.tsx`, `logic/filters.ts`).

An agent of a kind with a `models` block picks its model on its own page
(Env → agent → Model); a pick restarts a running agent. A new agent can
get one as it is made: Choose agent and first launch show a Model step
when the kind has a `models` block and a model on the phone passes the RAM
gate (`state/flows/logic/modelStep.ts`). "The agent's own setup" starts
picked; a model that cannot be set takes the new agent back out and says
why.

A card says "Context 48k of 256k: reduced so it runs well on this phone"
when automatic serves less than the trained context (k is 1024 tokens, as
model makers write it); so does the agent's Model section. The Context
setting (`context/ContextSetting.tsx`) is Automatic, or a slider over
whole 1024-token steps with its verdict live and a line on the speed cost
(`SPEED_NOTE`). Save is off past the phone's RAM; a save restarts the
agents on the model (`state/flows/modelContext.ts`), which brings the
server up with the new context.

While the model reads a prompt for the agent in front, the app bar shows
"Reading prompt · 4.1k" (`parts/ReadingChip.tsx`, from `runner.md` → Local
model servers) without changing its height. Pure parts live in
`src/ui/models/logic/` and `src/state/flows/logic/`, checked by
`scripts/vectors/test_models.js`.

## Tests

`./gradlew :phonecando-models:testDebugUnitTest` from `app/android`.
