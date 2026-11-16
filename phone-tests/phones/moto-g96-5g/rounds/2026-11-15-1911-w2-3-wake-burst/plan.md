# Plan: 2026-11-15-1911-w2-3-wake-burst

- **Phone:** [moto g96 5G](../../phone.md)
- **Build:** W2-3 ([builds.md](../../../../builds.md))
- **Source:** the plan file the tester read ("Phone test: wave 2, final
  round"), copied on 2026-11-16 with case IDs added and lightly edited.
  Its notes went outside the repo.

## Cases

- [MSG-08](../../../../cases/messages.md#msg-08) A burst of 3 waking messages to a stopped agent gives one start and one prompt
- [MSG-09](../../../../cases/messages.md#msg-09) A local-model agent woken by a message is not stopped while its model reads the prompt
- [MSG-10](../../../../cases/messages.md#msg-10) An answer to a waking message wakes the agent that asked
- [MSG-11](../../../../cases/messages.md#msg-11) A reply to that answer doesn't wake anyone (hop limit)
- [MODEL-07](../../../../cases/local-models.md#model-07) Saving a Memory page change, then setting it back
- [LIFE-04](../../../../cases/lifecycle.md#life-04) Quitting an agent's own app on purpose gives no "stopped by itself" notice
- [BACK-01](../../../../cases/bring-back.md#back-01) A run cut off by a reboot is offered back, and Continue goes on in the same chat

## Steps

App: "PhoneCanDo Full Dev" (`com.phonecando.app.full.dev`); a new build is
installed when you start. Agents: opencode "A-01" (cloud model, the
reliable sender), Claude Code "A-04" (local Qwen3.5 0.8B: slow, it reads a
~14k-token prompt in about 5 minutes), Codex "A-10" (0.8B), Gemini CLI
"A-05" (waiting at a folder-trust question: never answer it). Keep the
screen on (`adb shell svc power stayon usb`) and never turn it off: the
phone has a lock only I can open. Set `stayon false` at the end. Skip
anything not listed.

### Setup

Stop A-10 and A-05 if they run (each agent's page, or Home's Stop), so the
0.8B has RAM. Make sure A-04's "Other agents can wake it" and A-01's are
both on. Then stop A-04 too.

### 1. A burst of messages starts a stopped local-model agent once; its answer wakes the asker

1. (MSG-08) In A-01, start a new session and send: Use agents_send three
   times, one right after another, to Claude Code: first "note 1: hello",
   then "note 2: hello again", then "question: reply to me with the word
   hi". Set wake true on each. Don't call agents_wait: end your turn after
   sending.
2. (MSG-08) Note A-01's three tool results. The first should say woken /
   starting in the background, and they should tell it not to wait ("its
   answer wakes you").
3. (MSG-09) A-04 should start (drawer or notification), then read its
   prompt for several minutes. Read the end of its model log every 2-3
   minutes
   (`adb shell run-as com.phonecando.app.full.dev tail -c 1500 files/logs/model-server-qwen3-5-0-8b-q4-k-m.log`;
   note the "prompt eval time … / N tokens" lines). It must NOT be stopped
   at the 3-minute mark while the model reads; note any "said nothing for
   3 minutes" notice.
4. (MSG-08) Messages page: one start, the three messages delivered
   together (one prompt). Note what each shows ("started …").
5. (MSG-10) When A-04 answers (it should use replyTo), A-01 should wake by
   itself and show the answer in its chat, with no prompt from you.
   Messages should show the answer as having woken opencode. Note the
   times. Wait up to 25 minutes in all.
6. (MSG-11) Hop limit: then in A-01, send: Reply to Claude Code's answer
   with agents_send, replyTo set to its message id, text "thanks", wake
   true. A-04 should NOT be woken by that (its result should say why).

### 2. Saving a Memory page change (MODEL-07)

With no agent working on the 0.8B (stop A-04 first if it still works), open
the 0.8B's model page, then Memory, then Advanced. Set Saved chats to 1,
then Save. The model should restart (or say it will start with the new
choice at its next start). Check the Memory button or line now shows "1
set" or the changed value, and that nothing errored. Then set Saved chats
back to Auto and Save again. Note what you saw each time.

### 3. Quitting a TUI on purpose gives no "stopped by itself" notice (LIFE-04)

Start A-04 in its own app (its Home shows its terminal). Send: Say hello in
one short line. While it is reading or working (the first 30 seconds),
press Ctrl+C twice in its terminal (use
`adb shell input keycombination 113 31` twice, one second apart), so
Claude Code quits. Over the next 2 minutes, no "cut off" or "stopped by
itself" notification should come for A-04 (PhoneCanDo's notifications
only; don't scroll through personal ones).

### 4. LAST: bring back a cut-off run (BACK-01; one phone reboot; I unlock the phone)

1. In A-01 (a new session), send: Run a shell loop that writes the numbers
   1 to 600 into count.txt, one per line, with a 1 second pause between
   them, and tell me when it is done.
2. Once the loop runs (A-01's chat shows the command running for at least
   20 seconds), STOP and report to the main session that you are ready to
   reboot, then wait for its go: I'll be told to stand by to unlock. Then
   run `adb reboot`, `adb wait-for-device`, and wait until
   `adb shell getprop sys.boot_completed` prints 1.
3. Wait for me to unlock the phone (check every 30 s with
   `adb shell dumpsys window` that the lock screen is gone, up to 10
   minutes). Don't try to unlock it.
4. After the unlock, a notification "A-01…: cut off mid-task" (or the
   agent's name) should come, with Continue and Dismiss. Note its exact
   text. Tap Continue.
5. Expected: A-01 starts, its same session (the loop task still in it)
   gets a note from PhoneCanDo saying it was cut off, and it goes on (it
   should check count.txt and continue or report). Note what it does.

### Report (under 500 words)

Per test: pass, fail or not tested, with what you saw, the exact tool
results and notices, and test 1's prompt eval lines with times. List
errors, screenshots and why, and the agents and chats you touched.
