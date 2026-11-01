# Snapshots and observation

`mobile_observe` returns one compact snapshot. Node ids (`i`) are stable only
within a snapshot; actions carry the `snapshotId` they were resolved against.

```json
{
  "snapshotId": 42,
  "backend": "a11y",
  "package": "com.zepto",
  "activity": ".MainActivity",
  "window": {"id": 3, "type": "application"},
  "keyguard": false,
  "screenOn": true,
  "rotation": 0,
  "display": [1080, 2400],
  "ime": false,
  "focused": 7,
  "stable": true,
  "truncated": false,
  "nodes": [
    {
      "i": 7,
      "cls": "android.widget.EditText",
      "text": "Search",
      "id": "com.zepto:id/search",
      "bounds": [40, 210, 1040, 310],
      "clickable": true,
      "editable": true,
      "scrollable": false,
      "enabled": true,
      "checked": false,
      "selected": false,
      "focused": true,
      "password": false
    }
  ],
  "screenshot": {"path": "/data/.../tmp/snap-42.jpg", "w": 540, "h": 1200}
}
```

Rules:

- `i` is stable only within a snapshot. Actions carry `snapshotId`; a mismatch
  returns `STALE_SNAPSHOT`.
- Omit empty fields, drop non-visible/non-interactive nodes by default,
  bounds are four ints. `full: true` is for debugging only.
- `getWindows()` covers dialogs, IME, system UI, and multi-window.
- `isVisibleToUser()` plus bounds, not bounds alone.
- Screenshot is opt-in; save to a file and return the path. No base64 through
  the bridge.
- Secure windows return `secureWindow: true` and no screenshot; the tree still
  works where Android allows it.

## Screenshot concepts

There are two separate screenshot concepts, and only one is implemented:

1. **Observation screenshot** — `ObserveOptions(screenshot = true)` on the
   PCE, `mobile_observe({screenshot: true})` in the host. It is part of one
   snapshot and returns a `ScreenshotRef` (cache path, width, height, MIME type).
   The agent can read that path directly. This is the artifact path and is
   device-verified.
2. **Explicit action** — `Action.Screenshot(full)` is in the public action
   enum, but `Backend.execute` returns `PceResult<Unit>`, so it has nowhere to
   return bytes or a path. Every backend currently rejects it with
   `UNSUPPORTED_ACTION`. Do not add a `mobile_screenshot` wrapper that calls the
   action; it would only duplicate the observation path.

The PCE snapshot contract (dense node ids, staleness) is in
`pce/docs/api/snapshots.md`.
