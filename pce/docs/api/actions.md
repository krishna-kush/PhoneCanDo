# Actions

`Action` is the host-facing action; `Target` can be a resolved `NodeId`, a
`BySelector`, or screen `Coordinates`.

| Action | Notes |
|---|---|
| `Tap(target)` | Node or point. |
| `LongPress(target, durationMs)` | Node or point. |
| `TypeText(text, target?, clear)` | `clear = true` replaces the field; otherwise appends. |
| `Key(key)` | `ENTER`, `BACK`, `HOME`, `RECENTS`, `TAB`, `ESCAPE`, arrows, `DELETE`. |
| `Scroll(direction, target?, amount)` | Vertical/horizontal; node target or backend default. |
| `Swipe(from, to, durationMs)` | Screen coordinates. |
| `Wait(selector, timeoutMs)` | Polls observation until the selector resolves. |
| `Assert(selector)` | Fails with `ASSERTION_FAILED` when absent. |
| `Screenshot(full)` | Reserved; `Backend.execute` returns `Unit`, so there is no artifact path. Use `ObserveOptions(screenshot = true)`; current backends return `UNSUPPORTED_ACTION`. |
| `Launch(packageName, activityName?)` | Backend capability `LAUNCH`. |

`ActOptions(timeoutMs)` is the wait budget for `Action.Wait`; backend execution
timeouts remain backend-owned.
