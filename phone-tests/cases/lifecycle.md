# Agent lifecycle cases

Starting, updating, quitting and keeping an agent's work going.

This file is living: edit a case when the app changes. An ID never changes
and is never used again. A dropped case stays here, marked **Retired**, with
why. Latest results: [status.md](../status.md).

## Cases

<a id="life-01"></a>

### LIFE-01 Update agent says it starts the agent again, and does

- **Agents:** A-04.
- **Setup:** A-04 running in its own app.
- **Steps:** On its page, tap Update agent.
- **Expect:** The note says an update stops the agent first and starts it
  again when done. After it ends, Home shows it starting, then its
  terminal, not "stopped · Restart".
- **Touches:** runner `agents/install/`; app `ui/env/agent/AgentInstallPage.tsx`.

<a id="life-02"></a>

### LIFE-02 The CPU stays awake while a long local turn works, screen off

- **Agents:** A-04 (local 0.8B).
- **Setup:** none.
- **Steps:** Send A-04 a task, then turn the screen off
  (`adb shell input keyevent 223`). Mid-turn, read
  `adb logcat -d -s PhoneCanDoPower`.
- **Expect:** "holding the CPU awake for work" while it works, never
  "letting the CPU sleep" mid-turn.
- **Touches:** runner `power/`.
- **Note:** Our phone locks when the screen goes off, and only I can unlock
  it. Plan for that.

<a id="life-03"></a>

### LIFE-03 The notification never keeps an old chat's title

- **Agents:** A-04.
- **Setup:** A-04 has just finished a short chat.
- **Steps:** Type /clear, then send a new short task. Pull down the shade
  (`adb shell cmd statusbar expand-notifications`), look only at
  PhoneCanDo's lines, then collapse it.
- **Expect:** A-04's line does not show the old chat's title.
- **Touches:** runner `notify/`.

<a id="life-04"></a>

### LIFE-04 Quitting an agent's own app on purpose gives no "stopped by itself" notice

- **Agents:** A-04.
- **Setup:** A-04 running in its own app (Home shows its terminal).
- **Steps:** Send it a short task. While it works, press ^C twice on the
  extra keys bar, so Claude Code quits.
- **Expect:** For the next 2 minutes, no "cut off" or "stopped by itself"
  notice for A-04.
- **Touches:** runner `engine/tui/`, `cutoff/`, `notify/`.
- **Note:** `adb shell input keycombination 113 31` does not reach the
  terminal; use the on-screen ^C key.
