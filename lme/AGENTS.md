# LME rules — read before touching `lme/`

`lme/` is the local model engine: it finds, fetches, checks and plans the
serving of model weights on the phone. PhoneCanDo owns it and is its only
consumer. Every rule here is a quality gate.

## 1. Product boundary

The LME owns:

- reading GGUF headers (`gguf`)
- the Hugging Face catalog: search, files, variants, download URLs,
  suggestions (`catalog`)
- the models dir: `models.json`, downloads with resume, imports, delete
  (`store`, layout in `ModelLayout`)
- the runtime seam, the llama-server launch plan, readiness and the RAM
  gate (`host`)
- the llama-server payload build (`lme/llamacpp/`)

The host app owns the Android module (`phonecando-models`: paths, jobs,
the file picker, the token in Keystore, `DeviceInfo`), the runner's model
slot (the process, its port and key), the one join with agents
(`LocalModelBinding`) and every screen. If a change needs `android.*`, a
Context, an agent concept or UI text beyond a short reason, it does not
belong here. `lme/` never imports `agents/`, `lre/`, `pce/` or `tce/`, and
`agents/` never imports `lme/`.

## 2. Dependency law

```
api <- gguf
api <- catalog
api + gguf <- store
api <- host
gguf + host <- cli         (a leaf for CI: nothing depends on it, never published)
```

- `catalog`'s tests also use `host`: `SuggestedRamTest` checks the phone
  sizes in `suggested.json` against the RAM gate. Its main code never does.
- Pure JVM (Kotlin, JDK 17 toolchain): no `android.*`, no `org.json`, no
  app types. kotlinx-serialization-json stays `implementation` in
  `catalog`, `store` and `cli`.
- `catalog` and `store` never see each other: the host turns a catalog
  variant into a `DownloadRequest`. `host` plans from a `ModelRecord` and a
  `DeviceInfo` and never reads a file.
- The build files are the law. Test helpers shared across modules are test
  fixtures (`api`: `FakePort`; `gguf`: `GgufBytes`), never main code.

## 3. Errors and secrets

- Every expected failure is a typed `LmeException`; local disk errors stay
  `IOException`. A message names the thing, never a secret: URLs go
  through `redactUrl`.
- The Hugging Face token is only ever a parameter (`HfCatalog`,
  `ModelStore.download`). It goes to `https://huggingface.co` only
  (`Redirects` drops it on a hop elsewhere); lme never stores or logs it.
- The server's API key is per boot (`ApiKeys`), passed in the environment
  (`LLAMA_API_KEY`), never on the command line; every type that holds it
  hides it in `toString`.

## 4. Contracts

- `ModelLayout` is the one description of the models dir. `models.json` is
  versioned; a shape change bumps the version and reads no older one (no
  migrations, no shims: we are pre-release).
- A file becomes part of a model only after its size, sha256 and GGUF
  header check out; a download resumes, an import never half-exists.
- `LlamaCppRuntime` is the contract with the payload: its flags, wire APIs
  and required CPU features match the pinned server. `verify.sh` checks
  the strings the plan relies on; a pin bump rechecks the flags against
  the new `--help`.
- The RAM numbers live in `RamRules` only; `RamGateTest` pins the table.
  `suggested.json` (catalog, read by the app and the website) holds the
  phone sizes each suggestion runs on, worked out from them;
  `SuggestedRamTest` fails when the file drifts.

## 5. Payload (`lme/llamacpp/`)

- Built from `pins.env` and our `patches/` only: every download
  sha256-verified; a bump edits version, URL and sha256 together and
  checks every patch still applies; the build is reproducible (CI builds
  twice). The NDK is the same as proot's.
- Everything a phone executes ships from the APK's native-library dir as
  `lib*.so`: 16 KB aligned, NEEDED system libs only. Staged libs are never
  committed.
- Licences and where they must be listed: `lme/llamacpp/NOTICE.md`.

## 6. Testing

- Every non-trivial branch has a test. Fixtures are recorded responses
  (`catalog/src/test/resources/catalog/`, public API, no token) and
  synthetic GGUF bytes, not real downloads.
- `LME_GGUF_DIR=<dir of .gguf files>` turns on the real-file test (off by
  default).
- `cd lme && ./gradlew build` is green before a change is done.
- Payload changes: `build.sh` + `verify.sh` locally or in `llamacpp.yml`.
  No claim about speed or memory on a phone without device logs.

## 7. CI and workflow

- `lme.yml` builds the JVM modules, `llamacpp.yml` the payload, and
  `suggested-models.yml` checks weekly that every file `suggested.json`
  pins is still on the Hub as pinned; each runs only for the `paths:` it
  lists. A new input to any of them gets its path in the same change.
- Never run git commands; the user owns git.
- One concern per change. Update `docs/planning/todo.md` when scope or
  status moves. The smallest complete change wins.
