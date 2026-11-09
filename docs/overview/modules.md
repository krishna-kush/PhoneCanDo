# Modules

PhoneCanDo has three native Expo modules, one engine seam, and a small set of
UI features. The PCE (`pce/`) and the Linux runtime engine (`lre/`) are
separate Gradle products.

## Native and engine

| Area | Path | Doc |
|---|---|---|
| Engine host: agents, engines, foreground service | `app/modules/phonecando-runner/` | `../../app/docs/modules/runner.md` |
| PTY + xterm bridge | `app/modules/phonecando-terminal/` | `../../app/docs/modules/terminal.md` |
| Linux host: envs, images, jobs, terminal recipes | `app/modules/phonecando-linux/` | `architecture.md` → Linux runtime |
| Engine seam | `app/src/engine/` (`engines.ts`, `ensureEngine.ts`, `connection.ts`, `agents/`, `linux/`, `terminal.ts`, `files.ts`, `auth.ts`) | `../../app/docs/modules/runner.md` |
| Loopback bridge + tools | runner `bridge/`, `agents/shared/phone-tools/`, `agents/native/opencode/config/plugins/` | `../../app/docs/modules/bridge.md` |
| PCE host integration | runner `src/uiauto`, `PceAutomationImpl` | `../../app/docs/modules/automation.md` |
| Linux runtime | `lre/` (`api`, `tar`, `oci`, `image`, `cli`, `launcher/`, `proot/`, `images/default/`) | `architecture.md` → Linux runtime |

## UI features

| Area | Path | Doc |
|---|---|---|
| Home / chat and the agent switcher | `app/src/ui/chat/`, `app/src/ui/common/agent-switcher/` | `../../app/docs/modules/chat.md` |
| Terminal (agent TUI or image shell) | `app/src/ui/terminal/` | `../../app/docs/modules/terminal.md` |
| Env: envs, machines, agent pages, New env | `app/src/ui/env/` (pure parts in `logic/`) | `architecture.md` → Linux runtime |
| First launch | `app/src/ui/setup/` | `../../app/docs/guides/quickstart.md` |
| Settings (app-wide options) | `app/src/ui/settings/` | screens are self-contained |
| Shared UI, bridge prompt queue | `app/src/ui/common/` | theme/tokens, common components, `../../app/docs/modules/bridge.md` |
| State | `app/src/state/` | Zustand stores: `app.ts` (navigation, prefs, telemetry slices), `agents.ts`, `linux.ts`, `keyboard.ts`; multi-step flows in `flows/` |

## Supporting trees

| Area | Path | Doc |
|---|---|---|
| Agent kinds, kit and runtimes | `agents/` | `../../agents/AGENTS.md` |
| Native payload build | `agents/native/<id>/build/`, `agents/kit/native/` | `../../agents/native/opencode/docs/README.md` |
| proot and the Default image | `lre/proot/`, `lre/images/default/` | `architecture.md`, `../guides/testing.md` (CI) |
| Site | `web/` | `../../web/README.md` |
| PCE | `pce/` | `../../pce/docs/README.md` |

## Dependency direction

```
screens, state -> app/src/engine -> app/modules/* -> native
                        |                  └─ phonecando-linux -> lre/
                        +-> agent engines (loopback, one per agent)
```

Screens do not import native modules. `app/src/engine/` is the only seam.
The dependency laws inside the separate builds: `pce/AGENTS.md`,
`lre/AGENTS.md`, `agents/AGENTS.md`.
