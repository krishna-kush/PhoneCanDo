# Modules

PhoneCanDo has two native Expo modules, one engine seam, and a small set of UI
features. The PCE is a separate Gradle product at `pce/`.

## Native and engine

| Area | Path | Doc |
|---|---|---|
| Engine host | `app/modules/phonecando-runner/` | `../../app/docs/modules/runner.md` |
| PTY + xterm bridge | `app/modules/phonecando-terminal/` | `../../app/docs/modules/terminal.md` |
| Engine seam | `app/src/engine/` | `../../app/docs/modules/runner.md` |
| Loopback bridge + tools | runner `BridgeServer.kt`, `plugins/mobile/index.ts` | `../../app/docs/modules/bridge.md` |
| PCE host integration | runner `src/uiauto`, `PceAutomationImpl` | `../../app/docs/modules/automation.md` |

## UI features

| Area | Path | Doc |
|---|---|---|
| Home / chat | `app/src/ui/chat/` | `../../app/docs/modules/chat.md` |
| Terminal | `app/src/ui/terminal/` | `../../app/docs/modules/terminal.md` |
| Env | `app/src/ui/env/` | screens are self-contained |
| Settings | `app/src/ui/settings/` | screens are self-contained |
| Shared UI | `app/src/ui/common/` | theme/tokens and common components |
| State | `app/src/state/` | Zustand stores |

## Supporting trees

| Area | Path | Doc |
|---|---|---|
| Native payload build | `docs/bootstrap/`, `scripts/bootstrap/` | `../bootstrap/README.md` |
| Site | `web/` | `../../web/README.md` |
| PCE | `pce/` | `../../pce/docs/README.md` |

## Dependency direction

```
screens -> app/src/engine -> app/modules/* -> native
                      |
                      +-> opencode serve (loopback)
```

Screens do not import native modules. `app/src/engine/` is the only seam.
Within the PCE, the dependency law is documented in
`pce/docs/overview/architecture.md`.
