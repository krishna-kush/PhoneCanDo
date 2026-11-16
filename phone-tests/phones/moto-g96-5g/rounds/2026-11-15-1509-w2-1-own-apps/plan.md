# Plan: 2026-11-15-1509-w2-1-own-apps

- **Phone:** [moto g96 5G](../../phone.md)
- **Build:** W2-1 ([builds.md](../../../../builds.md))
- **Source:** rebuilt on 2026-11-16 from the tester's notes. It ran the
  parts of [the first W2-1 plan](../2026-11-15-1347-w2-1-first/plan.md)
  that the first tester didn't reach (B1, B2, B4 and F1), and put back
  Gemini's wake switch. The plan it read was not kept.

## Cases

- [CHECK-02](../../../../cases/checks.md#check-02) Check now starts an agent that ran in its own app again afterwards
- [CHECK-03](../../../../cases/checks.md#check-03) Stop on Home during the check's ACP part ends the whole check
- [CHECK-04](../../../../cases/checks.md#check-04) The notification's Stop during a check
- [LIFE-01](../../../../cases/lifecycle.md#life-01) Update agent says it starts the agent again, and does
- [SCHED-04](../../../../cases/schedules.md#sched-04) Run now reads "(run now at …)" with its time
- [SCHED-05](../../../../cases/schedules.md#sched-05) Run now marks a once schedule done

## Steps

1. Clean up first (F1): in Claude Code A-04's terminal, remove
   `~/projects/.claude/.projects/memory/schedule_add.txt` with `!rm -f` and
   check it is gone with `!ls`.
2. (CHECK-02, CHECK-03, CHECK-04) Check now on A-04 in its own app; when it
   ends, A-04 should run in its own app again. Then Check now again and
   press Stop (on Home or in the notification) mid-check: afterwards it
   should stay stopped.
3. (LIFE-01) Update agent on A-04.
4. (SCHED-04, SCHED-05) A once schedule for an agent an hour ahead, with a
   short task; tap Run now.
5. Put Gemini A-05's "Other agents can wake it" back on. Set
   `stayon false` at the end.
