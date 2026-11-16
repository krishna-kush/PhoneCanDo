# Plan: 2026-11-14-1647-acp-regression

- **Phone:** [moto g96 5G](../../phone.md)
- **Build:** ACP ([builds.md](../../../../builds.md))
- **Source:** rebuilt on 2026-11-16 from the tester's kept summary, which
  numbered its tests R1 to R10. The plan it read was not kept.

## Cases

- [ACP-04](../../../../cases/acp.md#acp-04) A message wakes an idle Claude Code (app in the background) into ACP (R1)
- [MSG-01](../../../../cases/messages.md#msg-01) Wake switch off keeps a message queued; on again wakes (R5)
- [SCHED-01](../../../../cases/schedules.md#sched-01) A schedule while the agent is busy waits, then runs (R7)
- [ACP-05](../../../../cases/acp.md#acp-05) Stop on the background view (R8)
- [ACP-06](../../../../cases/acp.md#acp-06) Deny a permission question (R9)
- [SCHED-02](../../../../cases/schedules.md#sched-02) opencode schedule runs as before (R10)

## Steps

As in each case. The summary also names tests that have no case here:

- R2: a fresh or interrupted Claude Code terminal and a waiting message.
- R3: a run the 0.8B ends by itself.
- R4: opening a stopped Claude Code while a wake message waits.
- R6: Run now on a schedule.
