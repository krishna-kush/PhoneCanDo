---
round: 2026-11-14-1647-acp-regression
phone: moto-g96-5g
build: ACP
tester: Claude Opus 5.5, effort xhigh, an AI over adb
prompt: not kept (see prompt.md)
human_steps: none marked
started: 2026-11-14 16:47
ended: 2026-11-14 18:54
---

# Results: 2026-11-14-1647-acp-regression

Back-filled on 2026-11-16 from the old `phone-tests.md` and the tester's
kept summary ("Phone regression round 2").

## Results

| ID | Result | Trials | Evidence | What it saw |
|---|---|---|---|---|
| [ACP-04](../../../../cases/acp.md#acp-04) | Pass | — | — | no detail kept |
| [MSG-01](../../../../cases/messages.md#msg-01) | Pass | — | — | no detail kept |
| [SCHED-01](../../../../cases/schedules.md#sched-01) | Pass | — | [schedule-runs.txt](evidence/schedule-runs.txt) | the task waited, then ran; but see bug 4 below |
| [ACP-05](../../../../cases/acp.md#acp-05) | Pass | — | — | no detail kept |
| [ACP-06](../../../../cases/acp.md#acp-06) | Pass | — | screen | notice and in-app dialog; the agent got "User refused permission to run tool" |
| [SCHED-02](../../../../cases/schedules.md#sched-02) | Pass | — | — | no detail kept |

## Other things seen

From the tester's summary:

- By design: R6, Run now runs at once. R2, a fresh or interrupted terminal
  has no waiting Stop hook, so a message waits while you watch, and goes
  over ACP once you leave.
- Not tested: R3, because the 0.8B never ended a run by itself.
- Bugs it found, worst first:
  1. Every switch between the terminal and ACP unloads and reloads the
     local model, so the prompt is read again (13-18k tokens at about 2k a
     minute): 5-9 minutes before any output.
  2. R4: opening a stopped Claude Code starts its terminal, then a queued
     wake message switches it to ACP 2.5 s later, while you are on its Home
     (the view isn't counted as watching yet).
  3. The memory guard stopped Claude Code mid background run (17:52) while
     opencode sat idle (wrong pick), even at 64k.
  4. R7: the run log says "asked · it could not be woken" and a "scheduled
     task due" notice is posted, though the task was delivered woke=true
     and ran.
  5. The permission notice "Waiting for your answer." stays after Deny
     until the run stops.
- Outside ACP: keys typed on a page land in opencode's web chat behind it
  (later [PAGE-01](../../../../cases/app-pages.md#page-01)); the first tap
  on the header often misses the drawer; the drawer and Schedules never go
  idle for `uiautomator`; `agents_send` defaults to wake=false.

## Left on the phone

`deny-test.txt` and `acp-test.txt` in Claude Code's machine; its terminal
now resumes chat 36709685; the 0.8B's context at 64k; my three opencode
schedules untouched.

## Screenshots

Some (Home, the drawer, schedule lists); they stay outside the repo.
