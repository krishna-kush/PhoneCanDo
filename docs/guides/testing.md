# Testing and evaluation

## App checks

- `pnpm typecheck` (`tsc --noEmit`) — TypeScript.
- `pnpm check:vectors` — the pure-logic vectors (terminal keys and
  reconcile, scroll keys, keyboard room, agent offers and installs, the web
  adapter, chat pages, models).
- Agent kinds: `cd agents && ./gradlew build`, `pnpm -C agents check`.
- JVM tests of the engine host (agents, supervisor, ports, reaper, bridge
  router, lease, prompts, redaction) and the Linux host (records, jobs,
  terminal recipes, play refusals), from `app/android`:
  `./gradlew :phonecando-runner:testLiteDebugUnitTest
  :phonecando-linux:testLiteDebugUnitTest` (`Full` and `Play` too).
- PTY core on the host: `sh app/modules/phonecando-terminal/android/src/test/c/run.sh`.
- On-device: logcat `[phonecando-kb]` / `[phonecando-size]`, plus
  `adb exec-out screencap` for any layout claim.

## Linux runtime checks

- `cd lre && ./gradlew build` — the pure-JVM modules (`api`, `tar`, `oci`,
  `image`, `cli`) and their tests.
- `bash lre/launcher/test/run.sh` — the launcher's parser, exec plan and
  signal rules, then end to end through a fake proot.
- `bash lre/launcher/test/proot-test.sh <proot-dir> <rootfs>` — the launcher
  with a host proot build (`lre/proot/build-glibc.sh`; `/` works as the
  rootfs): background processes, exit statuses and the terminal as on a PC.
- `lre/proot/verify.sh` checks a proot build at the ELF level;
  `lre/images/default/verify.py` checks a Default image build.
- Anything proot does on the phone needs device proof
  (`../../app/docs/context.md` → Linux images).

## CI workflows

Each workflow runs only for the `paths:` it lists (AGENTS.md rule 11), plus
nightly or weekly and on demand; `lint`, `security` and `codeql` run on
everything. The `*-ok` job is the one check to require for each.

| Workflow | Gate | What it proves |
|---|---|---|
| `ci.yml` | `ci-ok` | typecheck and vectors, the Android JS bundle and config plugins, generated files, theme spec, website build, script wiring, the release preflight tests (`scripts/release/`), and the licence notices, Licenses dialog and shipped items in sync |
| `android.yml` | — | prebuild; debug APKs per channel with the runner and Linux JVM tests and an APK audit each; a release-shape lite + full build (proot from a `proot.yml` run id, the Default image the lock names when there is one; audited per channel); the PTY host test, lint, emulator smoke |
| `lre.yml` | `lre-ok` | the `lre/` Gradle build and tests; the launcher built with gcc and run against its host tests |
| `proot.yml` | `proot-ok` | the pinned proot for arm64 Android (ELF-checked); the same sources built for glibc, booting an Alpine rootfs and running our launcher (background processes, statuses, the terminal); the GPL source pack |
| `lre-image.yml` | `lre-image-ok` | the Default image built twice to the same bytes, tier 1 (the image through our launcher and proot as opencode uses it), its Debian sources and `lock.json`; on prod and on demand only, a green image becomes the prerelease `linux-image-<version>`, which `./manage image lock <run-id>` adopts |
| `lre-compat.yml` | `lre-compat-ok` | tier 2 (blocking): one registry image per package family set up with `lre/cli` and used as a native engine uses it, plus an agents leg per runtime plugin and family (installed twice, as the phone's install job does); tier 3: a weekly report-only rotation that opens or updates one issue |
| `agents.yml` | `agents-ok` | the `agents/` Gradle build, TS checks, dependency law and manifests |
| `agent-payload.yml` | — | per native kind: patches and pins against upstream, and the payload build |
| `lme.yml` | `lme-ok` | the `lme/` Gradle build and tests: GGUF reader, catalog over recorded responses, model store, launch plan, RAM gate |
| `network.yml` | `network-ok` | the `network/` Gradle build and tests: HTTP port, redirect and error rules, resumable verified downloads, retries (lme.yml and lre.yml also run on its changes) |
| `llamacpp.yml` | `llamacpp-ok` | the pinned llama-server for arm64 Android, ELF-checked and built twice to the same bytes |
| `local-models.yml` | `local-models-ok` | every agent kind with a `models` block, installed in an x86_64 container as the phone installs it, runs its one-shot mode against our llama-server (the same pins built for Linux, started from lme's launch plan) once per test model (one per chat template). A run passes on exit 0, output on stdout and at least one answer the server finished: it proves the wiring, not the model. Weekly (Mondays) against each kind's newest release |
| `suggested-models.yml` | `suggested-models-ok` | every file in lme's `suggested.json` is still on the Hugging Face Hub as pinned: its repository, commit, size and sha256 from one HEAD request each (no download, no token). Weekly (Mondays) too, so a repository gone, gated or rewritten shows before a phone finds it |
| `pce.yml`, `tce.yml`, `web.yml` | `pce-ok`, `tce-ok`, `web-ok` | their own trees |

## Automation test layers

In the target contract, every `mobile_execute` produces a trace:

```json
{
  "traceId": "tr_01...",
  "contract": "1.0",
  "pack": "com.zepto@3",
  "steps": [
    {"action": "tap", "ok": true, "ms": 142, "snapshotId": 42}
  ],
  "artifacts": ["/data/.../snap-42.jpg"],
  "result": "ok"
}
```

- Ring buffer in app-private storage; export on demand.
- Metrics: success rate per flow/pack, latency, retries, ambiguity rate.
- `mobile_doctor` (target) reports backend/pack/bridge state.
- Contract tests: JSON schema validation for describe/observe/execute.
- Unit tests: resolver, compaction, DSL parser, pack validation.
- On-device smoke: `androidx.test.uiautomator` instrumentation.
- Host CI: Maestro black-box flows; not the runtime.

## PCE tests

- Pure JVM: `./gradlew :api:test :core:test`.
- Runnable proof: `./gradlew :sample:run`.
- Full build: `./gradlew build`.
- Backend contract tests: one suite per backend via `BackendContract.verify`;
  Android-specific behavior also needs device evidence.
- Host-side tools are oracles, never runtime dependencies.

See `pce/docs/guides/testing.md` for the PCE harnesses and exact device
commands.

## Evidence rule

No sizing, layout or device claim is accepted without logs or pixels;
Android behavior, IME, sizing and accessibility need device evidence, and
type-checking alone is not proof. Keep vectors in sync with the code they
test or delete them.
