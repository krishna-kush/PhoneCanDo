# Results file shape

Every round's `results.md` has this shape. The tester fills it in; after
that it is frozen. A later fix to it goes in a dated note at its end, never
as an edit to the results.

## Front matter

```yaml
---
round: 2026-11-15-1911-w2-3-wake-burst   # the folder's name
phone: moto-g96-5g                       # the phone's folder
build: W2-3                              # as in builds.md
tester: Claude Opus 5.5, effort xhigh, an AI over adb
prompt: prompt.md                        # in this folder, as sent
human_steps: none                        # or what I did, such as "I unlocked the phone"
started: 2026-11-15 19:11
ended: 2026-11-15 19:29
---
```

## Body

```markdown
# Results: <round>

One or two lines: what ran, and anything that changed the plan.

## Results

| ID | Result | Trials | Evidence | What it saw |
|---|---|---|---|---|
| [MSG-08](../../cases/messages.md#msg-08) | Pass | 1 | [MSG-08.txt](evidence/MSG-08.txt) | short facts, screen text in quotes |

## Other things seen

Bugs or oddities outside the cases, each with its time.

## Left on the phone

Agents running or stopped, switches changed, files left, chats touched.

## Screenshots

How many, and why dumps were not enough. They stay outside the repo.
```

## Rules for the table

- One row per case ID in the plan, in the plan's order. A case seen but not
  planned gets a row too, saying so.
- Write the ID exactly as the case does (`MSG-08`), linked to its case.
- Result is one of Pass, Fail, Flaky, Blocked or Not run
  ([AGENTS.md](AGENTS.md) says when).
- Trials: how many times the case ran; for Flaky, how many passed (2/3).
- Evidence: a file in `evidence/`, or "screen" when the row's quote is
  the evidence.
- Mark any step I took in the row ("I unlocked the phone").
