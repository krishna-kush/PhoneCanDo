# Errors and recovery

Every failure is structured:

```json
{
  "ok": false,
  "code": "STALE_SNAPSHOT",
  "message": "snapshot 42 is older than the current window",
  "recover": {"action": "observe"},
  "traceId": "tr_01..."
}
```

| Code | Meaning | Recovery |
|---|---|---|
| `STALE_SNAPSHOT` | UI changed since observation | `mobile_observe` |
| `NOT_FOUND` | selector matched nothing | observe, scroll, wait |
| `AMBIGUOUS` | multiple plausible nodes | observe, use `i` or `index` |
| `NOT_VISIBLE` | node exists but is covered/offscreen | scroll or wait |
| `NOT_EDITABLE` | target cannot accept text | tap the field first |
| `KEYGUARD` | device is locked | ask the user |
| `SCREEN_OFF` | display is off | `wake`, then observe |
| `SECURE_WINDOW` | screenshot blocked | use the tree; do not retry |
| `BACKEND_UNAVAILABLE` | a11y/Shizuku missing | `mobile_open_accessibility` / Shizuku setup |
| `CONFIRM_REQUIRED` | high-risk action | ask the user |
| `APP_NOT_ALLOWED` | package outside allowlist | ask the user |
| `INVALID_PACK` | pack malformed or references an unknown action/selector | fix or disable pack |
| `PACK_SIGNATURE_INVALID` | pack signature/key mismatch | re-sign or reject pack |
| `PACK_INCOMPATIBLE` | pack needs another app/PCE | update or disable pack |
| `CONTRACT_UNSUPPORTED` | client/PCE mismatch | update one side |
| `TIMEOUT` | step exceeded budget | retry or observe |
| `CANCELLED` | user/agent aborted | stop |
| `INTERNAL` | bug | `mobile_doctor` + trace |

The recovery hint is part of the contract: the AI should be able to recover
without guessing. The bridge envelope has the same shape; see
`pce/docs/api/lifecycle.md` for the library-side `PceResult` rules.
