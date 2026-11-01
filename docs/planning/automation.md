# Automation roadmap

Current implementation and device proof: `../../app/docs/modules/automation.md`.

## Phases

| Phase | Scope | Outcome |
|---|---|---|
| **P0** | contract, describe/observe/act/execute, a11y backend, 5 actions, unit tests | AI can drive a flow in one call |
| **P1** | pack runtime (`pce-pack`, done), signed manifest (`PackStore`, done), hot reload, `mobile_flow`/`mobile_pack` | app knowledge updates without APK |
| **P2** | a11y + IME capability router, typed device actions; Shizuku WIP | reliable v1 device control |
| **P3** | screenshot + Set-of-Mark + OCR, redaction | canvas/WebView coverage |
| **P4** | MCP adapter, remote manifest, eval/trace dashboard | external agents + measurable reliability |
| **P5** | record/replay, pack authoring from traces | skills improve themselves |

## Non-goals

- A general-purpose scripting language or arbitrary code execution.
- A cloud SaaS control plane.
- A visual flow builder.
- iOS automation (later, via a different backend).
- Play Store automation (the `play` flavor strips the driver).
- Raw shell access for the model.

## Related

- `../../pce/docs/planning/todo.md` — open PCE work.
