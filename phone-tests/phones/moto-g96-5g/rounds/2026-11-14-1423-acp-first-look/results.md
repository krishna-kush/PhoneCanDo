---
round: 2026-11-14-1423-acp-first-look
phone: moto-g96-5g
build: ACP
tester: Claude Opus 5.5, effort xhigh, an AI over adb
prompt: not kept (see prompt.md)
human_steps: none marked
started: 2026-11-14 14:23 (its first kept file; it may have begun earlier)
ended: 2026-11-14 16:45 (its last kept file)
---

# Results: 2026-11-14-1423-acp-first-look

Back-filled on 2026-11-16 from the old `phone-tests.md`. The tester's own
report was not kept, so most rows have no detail.

## Results

| ID | Result | Trials | Evidence | What it saw |
|---|---|---|---|---|
| [ACP-01](../../../../cases/acp.md#acp-01) | Pass | — | screen | 8 rows Checked in 7-14 s; the Home bar showed |
| [ACP-02](../../../../cases/acp.md#acp-02) | Pass | — | — | no detail kept |
| [ACP-03](../../../../cases/acp.md#acp-03) | Pass | — | — | opencode, top and Aider; no detail kept |
| [SCHED-03](../../../../cases/schedules.md#sched-03) | Fail | — | [SCHED-03.txt](evidence/SCHED-03.txt) | Android killed the app, then the memory guard stopped the only working agent. The RAM rules changed after; it passed on 11-15 in [2026-11-15-0321-acp-morning](../2026-11-15-0321-acp-morning/results.md) |
| [PAGE-05](../../../../cases/app-pages.md#page-05) | Pass | — | — | no detail kept |

## Left on the phone

Not kept.

## Screenshots

Many (Claude Code's bars and pages, the drawer, schedule pages, the form);
they stay outside the repo.
