# Testing and evaluation

## App checks

- `pnpm typecheck` (`tsc --noEmit`) — TypeScript.
- `pnpm check:vectors` — terminal `keys` / `reconcile` vectors.
- On-device: logcat `[phonecando-kb]` / `[phonecando-size]`, plus
  `adb exec-out screencap` for any layout claim.
- Device evidence is required for Android behavior, IME, sizing and
  accessibility claims. Type-checking alone is not proof.

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

No sizing, layout or device claim is accepted without logs or pixels. Keep
vectors in sync with `keys.ts` / `reconcile.ts` or delete them.
