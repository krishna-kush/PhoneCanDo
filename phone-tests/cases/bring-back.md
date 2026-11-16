# Bring back cut-off run cases

When a run is cut off (the phone restarts, or Android closes PhoneCanDo),
the app offers it back with Continue and Dismiss.

This file is living: edit a case when the app changes. An ID never changes
and is never used again. A dropped case stays here, marked **Retired**, with
why. Latest results: [status.md](../status.md).

## Cases

<a id="back-01"></a>

### BACK-01 A run cut off by a reboot is offered back, and Continue goes on in the same chat

- **Agents:** A-01.
- **Setup:** none. Needs one phone reboot, and on our phone I unlock it.
- **Steps:** In A-01, a new session, give it a task that runs for minutes
  (for example ten `sleep 100` runs one after another). Mid-turn, run
  `adb reboot`, then wait for `sys.boot_completed` to read 1. Wait for the
  unlock; don't try it yourself. Tap Continue on the notice.
- **Expect:** A notice "opencode: cut off mid-task" says the phone restarted
  while it worked on the chat, with Continue and Dismiss. After Continue,
  the agent works on in the same chat, with a note from PhoneCanDo saying it
  was cut off.
- **Touches:** runner `cutoff/`, `notify/`.

<a id="back-02"></a>

### BACK-02 Android killing the app is offered back

- **Agents:** any agent mid-turn.
- **Setup:** An agent working when Android closes PhoneCanDo's process.
- **Steps:** Start the app again after Android closed it.
- **Expect:** Only agents that were really working are offered back, with a
  notice saying Android closed PhoneCanDo while it worked. An idle agent
  gets no notice.
- **Touches:** runner `cutoff/`.

<a id="back-03"></a>

### BACK-03 Dismiss, or a later reboot, gives no notice

- **Agents:** A-01.
- **Setup:** A cut-off notice as in [BACK-01](#back-01).
- **Steps:** Tap Dismiss. Later, reboot again with nothing running.
- **Expect:** No new notice for that run.
- **Touches:** runner `cutoff/`.

<a id="back-04"></a>

### BACK-04 A force stop gives no notice

- **Agents:** any agent mid-turn.
- **Setup:** none.
- **Steps:** Force stop the app (`adb shell am force-stop
  com.phonecando.app.full.dev`), then open it again.
- **Expect:** No cut-off notice: you stopped it on purpose.
- **Touches:** runner `cutoff/`.

<a id="back-05"></a>

### BACK-05 A cancelled installer gives no notice

- **Agents:** an agent being installed.
- **Setup:** none.
- **Steps:** Start an agent install, cancel it, then open the app again.
- **Expect:** No cut-off notice.
- **Touches:** runner `cutoff/`, `agents/install/`.

<a id="back-06"></a>

### BACK-06 Continue on a Claude Code (TUI) or ACP run

- **Agents:** A-04, once in its own app and once in an ACP turn.
- **Setup:** As in [BACK-01](#back-01), with A-04 mid-turn.
- **Steps:** Reboot mid-turn, wait for the unlock, tap Continue.
- **Expect:** It goes on in the same chat, as in [BACK-01](#back-01).
- **Touches:** runner `cutoff/`, `engine/tui/`, `engine/acp/`.
