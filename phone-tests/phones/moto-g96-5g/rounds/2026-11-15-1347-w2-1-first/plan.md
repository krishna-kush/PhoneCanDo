# Plan: 2026-11-15-1347-w2-1-first

- **Phone:** [moto g96 5G](../../phone.md)
- **Build:** W2-1 ([builds.md](../../../../builds.md))
- **Source:** the plan file the tester read ("Phone test plan: wave 2
  build"), copied on 2026-11-16 with case IDs added and lightly edited. Its
  notes went outside the repo.

## Cases

- [MODEL-06](../../../../cases/local-models.md#model-06) New model list format: old list read as damaged; delete and download again
- [MODEL-03](../../../../cases/local-models.md#model-03) Memory page: live line and Advanced
- [MODEL-05](../../../../cases/local-models.md#model-05) Detailed log switch is there, off, with its note
- [MODEL-04](../../../../cases/local-models.md#model-04) Memory page for the 4B
- [MODEL-02](../../../../cases/local-models.md#model-02) Two chats take turns: turn C reuses its saved state
- [LIFE-02](../../../../cases/lifecycle.md#life-02) The CPU stays awake while a long local turn works, screen off
- [CHECK-02](../../../../cases/checks.md#check-02) Check now starts an agent that ran in its own app again afterwards
- [CHECK-03](../../../../cases/checks.md#check-03) Stop on Home during the check's ACP part ends the whole check
- [CHECK-04](../../../../cases/checks.md#check-04) The notification's Stop during a check
- [LIFE-01](../../../../cases/lifecycle.md#life-01) Update agent says it starts the agent again, and does
- [LIFE-03](../../../../cases/lifecycle.md#life-03) The notification never keeps an old chat's title
- [SCHED-04](../../../../cases/schedules.md#sched-04) Run now reads "(run now at …)" with its time
- [SCHED-05](../../../../cases/schedules.md#sched-05) Run now marks a once schedule done
- [PAGE-01](../../../../cases/app-pages.md#page-01) Keys typed with a page or the drawer open don't reach opencode's page
- [PAGE-02](../../../../cases/app-pages.md#page-02) New agent shows Codex as "Messages · delivered"
- [PAGE-03](../../../../cases/app-pages.md#page-03) "Woken while idle" for ACP-only kinds
- [PAGE-04](../../../../cases/app-pages.md#page-04) Wake switch stays, with a line when its wake failed
- [MSG-02](../../../../cases/messages.md#msg-02) A waking message starts a stopped agent
- [MSG-04](../../../../cases/messages.md#msg-04) A started agent that hangs is stopped and you are told
- [MSG-03](../../../../cases/messages.md#msg-03) Waking switched off: not started, told why
- [BACK-01](../../../../cases/bring-back.md#back-01) A run cut off by a reboot is offered back, and Continue goes on in the same chat
- [LIFE-04](../../../../cases/lifecycle.md#life-04) Quitting an agent's own app on purpose gives no "stopped by itself" notice

## Steps

App: "PhoneCanDo Full Dev", package `com.phonecando.app.full.dev`. The new
build is already installed when you start. Write notes as you go (time,
step, what you saw). Use agents that work with a cloud model (signed in)
for every test except part A; part A needs the local model.

### 0. Models: fresh list (MODEL-06)

The model list's format changed, so the old one can't be read.

1. Open the app's Models page (from the drawer). Note what it shows (an
   error is expected).
2. Delete only the list:
   `adb shell run-as com.phonecando.app.full.dev rm files/models/models.json`
3. `adb shell am force-stop com.phonecando.app.full.dev`, then open the app
   again. The Models page should now be empty.
4. Download "Qwen3.5 0.8B" (Q4_K_M) and "Qwen3.5 4B" (Q4_K_M) again from
   the Models page's suggestions or search. Downloads run in the
   background: go on with parts B to D meanwhile, and check back.
5. Once the 0.8B is in, check that the Claude Code agent that used it still
   points to it (its agent page shows its model); if not, pick the 0.8B
   there again. Note what you did.

### A. Local model: the "after" run (needs the 0.8B)

1. (MODEL-03) Open the 0.8B's model page, then its Memory setting. Note the
   live line ("On this phone: context … · … chats saved · … GB"). Tap Less
   and More and check the line changes; then leave without saving (or put
   it back to Normal).
2. (MODEL-03) Open Advanced: note what it lists (Context, Note size, Saved
   chats, Snapshots, CPU threads) and their Auto values. Change nothing.
3. (MODEL-05) Open the 0.8B's Server log page: a "Detailed log" switch
   should be there, off, with a note that changing it restarts the model.
   Leave it off.
4. (MODEL-04) Open the 4B's Memory setting the same way and note its live
   line (expect 32k with half-size notes and few or no saved chats). Change
   nothing.
5. (MODEL-02, LIFE-02) Two chats taking turns on the one model. The 0.8B is
   too weak to start a sub-agent by itself, so the second chat is a second
   agent:
   - The second agent: Codex "A-10" also uses the 0.8B (the Claude Code
     agent is "A-04"). Codex may offer to reopen an old chat: answer n to
     start fresh.
   - Turn A: in the Claude Code agent (0.8B), /clear, then send: Say hello
     in one short line. Wait for its answer.
   - Turn B: in the second agent, start a new chat and send: Say hello in
     one short line. Wait for its answer.
   - Turn C: back in the Claude Code agent, same chat, send: Now say goodbye
     in one short line. Wait for its answer.
   - Turn the screen off while each turn works
     (`adb shell input keyevent 223`; wake with 224 to check). Once
     mid-turn: `adb logcat -d -s PhoneCanDoPower`, last 5 lines (it should
     not say the CPU may sleep while a turn works).

   Every 3-5 minutes, read the end of the model log
   (`adb shell run-as com.phonecando.app.full.dev tail -c 2000 files/logs/model-server-qwen3-5-0-8b-q4-k-m.log`),
   and note each "prompt eval time … / N tokens" line with its time and
   which turn it belongs to, plus any lines with "selected slot", "cache",
   "prompt", "checkpoint", "exceeds", "removing", "forcing".

   What we expect: turn A reads its whole prompt once (about 14,000
   tokens); turn B reads its own prompt; turn C should read only a few
   hundred tokens, because Claude Code's chat comes back from the saved
   chats instead of being read again. Before this build, turn C would read
   about 14,000 again. Save the log at the end. Stop a turn after 30
   minutes with no new "prompt eval time" line, and say so.

### B. Fixes in the agents' own apps

1. (CHECK-02, CHECK-03, CHECK-04) Check now: on a Claude Code agent running
   in its own app (Home shows its terminal), open its agent page, "What it
   can do", and run Check now. When it ends, the agent should be running
   again in its own app. Then run Check now again and press Stop (on Home
   or in the notification) mid-check: afterwards it should stay stopped.
2. (LIFE-01) Update agent: on that agent's page, Update agent. Its note
   should say it stops the agent first and starts it again when done.
   After it ends, Home should show it starting, then its terminal, not
   "stopped · Restart".
3. (LIFE-03) Notification title: in Claude Code, finish a short chat, type
   /clear, then start a new short task. Pull down the notification shade
   (`adb shell cmd statusbar expand-notifications`, then a uiautomator
   dump; collapse with `adb shell cmd statusbar collapse`): the agent's line
   should not show the old chat's title.
4. (SCHED-04, SCHED-05) Schedules: make a schedule "once" for an agent, an
   hour from now, with a short task. Tap Run now on it. The agent should
   read the task with "(run now at …)", and the schedule's row should then
   say it is done (no next time).

### C. App pages

1. (PAGE-01) Keys behind a page: make an opencode agent active (Home is its
   web page). Open Settings from the drawer, type
   `adb shell input text hello`, go Back to Home: opencode's message box
   must be empty. Do the same with only the drawer open. Then on Home
   itself, type `adb shell input text hi`: it should go into the message
   box (clear it after).
2. (PAGE-02) New agent: open New agent and find Codex: its messaging line
   should read "Messages · delivered" (not "inbox only").
3. (PAGE-03, PAGE-04) On a Gemini CLI or Qwen Code agent's page: "What it
   can do" → "Woken while idle" should read "In ACP mode: …" (or "Not
   working: …" if its ACP mode failed), not "Off". In its Messages part,
   "Other agents can wake it" should be shown; if its wake failed a check,
   a muted "We saw …" line sits under it.

### D. A message starts a stopped agent

1. Pick two agents with cloud models: a sender (e.g. Claude Code) and a
   receiver whose kind has an ACP mode (e.g. Qwen Code, Gemini CLI or
   another Claude Code). On the receiver's page, make sure "Other agents
   can wake it" is on. Stop the receiver.
2. (MSG-02) In the sender, ask: Use the agents_send tool to send (receiver
   name) the message "reply to me with the word hi" and let it wake them.
3. (MSG-02, MSG-04) Expect: the sender's tool result says it was woken /
   starts in the background; the receiver starts (drawer or notification),
   works and answers; the Messages page shows the message with "started".
4. (MSG-03) Turn the receiver's switch off, stop it again, and repeat step
   2: the tool result should say it was not started because waking it is
   switched off.

### E. Bring back a cut-off run (one phone reboot: allowed once)

1. (BACK-01) Give a Claude Code agent with a cloud model a task that runs a
   few minutes, e.g.: Run a shell loop that writes the numbers 1 to 300
   into count.txt, one per line, with a 1 second pause between them, and
   tell me when it is done.
2. While it runs, reboot: `adb reboot`. Wait for adb to come back
   (`adb wait-for-device`, then check `adb shell getprop sys.boot_completed`
   is 1).
3. If the phone shows a PIN, pattern or password lock after the reboot,
   STOP here and report: don't try to unlock it. If it is a plain swipe
   lock, swipe it open.
4. After unlock, a notification "(agent): cut off mid-task" should come,
   with Continue and Dismiss. Tap Continue. Expect: the agent starts in the
   same chat (its earlier messages still there) with a note from
   PhoneCanDo saying it was cut off, and it goes on.
5. (LIFE-04) Ctrl+C quit: start another long loop task, then in its
   terminal press Ctrl+C twice or type /exit so the TUI quits. No "stopped
   by itself" notification should come.

### F. Clean up

1. An earlier test's model left a junk file in Claude Code A-04's machine.
   In A-04's terminal, type
   `!rm -f ~/projects/.claude/.projects/memory/schedule_add.txt` and Enter
   (the leading ! runs it as a shell command), then check it's gone with
   `!ls ~/projects/.claude/.projects/memory/`.
2. Put back anything you changed (models, switches), and run
   `adb shell svc power stayon false`.

### Report (under 600 words)

Per part: pass / fail / not tested, with what you saw; part A's prompt eval
lines with times; screenshots taken and why; chats you touched.
