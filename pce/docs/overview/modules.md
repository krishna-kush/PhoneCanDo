# Modules

| Module | Artifact | Platform | Depends on | Purpose | Docs |
|---|---|---|---|---|---|
| `api` | `pce-api` | JVM | kotlinx.coroutines | Public contracts: snapshots, nodes, selectors, actions, errors, backend. | `../modules/api.md` |
| `core` | `pce-core` | JVM | `api` | Assembler, registry, resolver, verifier, trace, scheduler, PCE facade, capability router. | `../modules/core.md` |
| `json` | `pce-json` | JVM | `api` + kotlinx.serialization | Optional contract DTOs and JSON round-trip. | `../modules/json.md` |
| `pack` | `pce-pack` | JVM | `api` + `json` | Signed declarative packs and manifests: Ed25519, validation, compatibility, flow runtime. | `../modules/pack.md` |
| `testkit` | `pce-testkit` | JVM | `api` | Fake backend, fixtures and backend contract helpers. | `../modules/testkit.md` |
| `android` | `pce-android` | Android | `api` | Accessibility backend: observe, windows, actions, observation screenshots. | `../modules/android.md` |
| `ime` | `pce-ime` | Android | `api` | Tiny text/Enter/Backspace IME backend. | `../modules/ime.md` |
| `shizuku` | `pce-shizuku` | Android | `api` | **WIP, optional**: privileged key/gesture/launch backend. | `../modules/shizuku.md` |
| `sample` | not published | JVM | `core`, `testkit` | Runnable proof that a host can use the PCE. | `../modules/sample.md` |
| `consumer-sample` | not published | JVM | published `pce-api` / `pce-core` | Optional published-coordinate proof. | `../modules/consumer-sample.md` |

The bridge, auth, biometric gate, tool surface and app UI stay outside the
PCE. They are host adapters.

See `architecture.md` for the dependency graph and module rules.
