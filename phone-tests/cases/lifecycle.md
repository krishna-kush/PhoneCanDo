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

<a id="life-05"></a>

### LIFE-05 An agent whose kind a new build dropped says so and keeps its machine

- **Agents:** A-08 (Aider, which builds after 2026-11-19 no longer ship).
- **Setup:** A build without Aider installed over one that had it, with
  A-08 still on the phone.
- **Steps:** Make A-08 the active agent from the drawer. Tap Open terminal
  in its machine and run `aider --version`. Back on Home, tap Add it as a
  custom agent, then Back. Tap Agent settings.
- **Expect:** Home says "aider is no longer included", with no Retry and
  no error loop. The terminal opens in its machine and `aider` is still
  there. Add it as a custom agent opens an empty custom agent form. Its
  page shows the same line and Add it as a custom agent, no Start and no
  Open home, and still has Open terminal and Delete. The other agents,
  and A-08's machine mates, start as before.
- **Touches:** `chat/KindGoneHome.tsx`, `env/agent/EngineSection.tsx`,
  runner `agents/install/AgentInstalls.kt` (`guestUnset`).
