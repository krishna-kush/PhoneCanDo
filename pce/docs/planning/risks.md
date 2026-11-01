# Non-goals and risks

## Non-goals

- HTTP bridge, auth, bearer tokens, rate limiting.
- Biometric gate, master switch, app UI.
- AI tool names and prompt policy.
- Host-side automation frameworks at runtime.
- Copying unlicensed or AGPL code.
- Arbitrary shell execution from packs.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Android a11y fragmentation | Backend contract tests, device matrix, capability errors, no per-device constants. |
| IME behavior varies by keyboard/app | Tiny IME, explicit errors, Shizuku fallback, device evidence. |
| Shizuku availability/permissions | Capability gate; typed unavailable; never a hard dependency. |
| Scope creep into a full app | The product boundary and `AGENTS.md`; bridge/UI stay outside. |
| Public API churn | Semver, `@ExperimentalPceApi`, consumer sample, additive changes. |
| Stale snapshots acting on wrong screen | Snapshot ids, registry, explicit `STALE_SNAPSHOT`, no silent retries. |
| Too many modules | Add modules only with real code and a green standalone build. |
