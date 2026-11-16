# Schedule cases

Tasks set to reach an agent at a time.

This file is living: edit a case when the app changes. An ID never changes
and is never used again. A dropped case stays here, marked **Retired**, with
why. Latest results: [status.md](../status.md).

## Cases

<a id="sched-01"></a>

### SCHED-01 A schedule while the agent is busy waits, then runs

- **Agents:** A-04.
- **Setup:** A-04 working on a long turn.
- **Steps:** Make a schedule for A-04 due in a few minutes, while it still
  works.
- **Expect:** The task waits until the turn ends, then runs.
- **Touches:** runner `schedule/` (`DueRules`, `FireRules`).

<a id="sched-02"></a>

### SCHED-02 opencode schedule runs as before

- **Agents:** A-01.
- **Setup:** none.
- **Steps:** Make a schedule for A-01 due in a few minutes.
- **Expect:** It runs at its time in A-01's chat.
- **Touches:** runner `schedule/`.

<a id="sched-03"></a>

### SCHED-03 A scheduled task with the app closed

- **Agents:** A-04.
- **Setup:** none.
- **Steps:** Make a schedule for A-04 due in a few minutes. Close the app
  (swipe it away from recent apps). Wait past its time.
- **Expect:** At its time the agent starts and runs the task. The runs log
  says it started.
- **Touches:** runner `schedule/` (the alarm), `memory/` (the memory guard).

<a id="sched-04"></a>

### SCHED-04 Run now reads "(run now at …)" with its time

- **Agents:** A-01.
- **Setup:** none.
- **Steps:** Make a once schedule an hour ahead with a short task, then tap
  Run now on it.
- **Expect:** The agent reads "Scheduled task from the user (run now at
  …): …", with the time it ran.
- **Touches:** runner `schedule/`.

<a id="sched-05"></a>

### SCHED-05 Run now marks a once schedule done

- **Agents:** A-01.
- **Setup:** As in [SCHED-04](#sched-04).
- **Steps:** Tap Run now on a once schedule, then look at its row.
- **Expect:** The row reads "done · once, today …" with its time, and no
  next time.
- **Touches:** runner `schedule/`; app `ui/schedule/`.
