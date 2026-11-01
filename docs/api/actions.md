# Actions

Actions are typed and versioned. Packs may only reference IDs that exist in
the PCE's registry. There is no raw shell action.

| Action | Input | Backends | Risk | Postcondition |
|---|---|---|---|---|
| `launch` | `pkg`, optional `activity`, `extras` | pkg/a11y/shizuku | low | package foreground |
| `tap` | `i` or `point` | a11y/shizuku | low | UI stable |
| `longPress` | `i` or `point`, `durationMs` | a11y/shizuku | low | UI stable |
| `type` | `text`, optional `i`, `clear`, `submit` | a11y/shizuku | medium | text present |
| `key` | `enter/back/home/recents/tab/escape/up/down/left/right/delete` | a11y/shizuku | medium | UI stable |
| `scroll` | optional `i`, `direction`, `amount` | a11y/shizuku | low | UI changed or end |
| `swipe` | `from`, `to`, `durationMs` | a11y/shizuku | low | UI stable |
| `pinch` | `center`, `scale` | a11y/shizuku | low | UI stable |
| `wait` | `text`/`id`/`package`/`stable`, `timeoutMs` | PCE | low | predicate true |
| `assert` | `text`/`id`/`package`/`i` | PCE | low | predicate true |
| `screenshot` | `full` | a11y/shizuku | low | file written |
| `open` | `uri` | app | medium | activity started |
| `notify` | `title`, `text` | app | low | posted |
| `clipboard` | `get`/`set`, `text` | app | medium | value read/written |
| `appInfo` | — | app | low | foreground package |
| `appList` | — | app | low | installed apps |
| `wake` | — | a11y/shizuku | medium | screen on |
| `appStop` | `pkg` | shizuku | high | package stopped |
| `appClear` | `pkg` | shizuku | high | data cleared |
| `settingsGet`/`settingsPut` | `namespace`, `key`, `value` | shizuku | high | value applied |
| `permissionGrant`/`permissionRevoke` | `pkg`, `permission` | shizuku | high | grant state changed |

High-risk actions require an in-chat confirmation or an explicit user policy.
The action registry is the single source of truth for tool schemas, risk, and
backend availability. `shizuku` entries are the future optional backend; v1
supports only the a11y/IME subset described in `backends.md`.

The PCE action contract is in `pce/docs/api/actions.md`.
