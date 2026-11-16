# Plan: 2026-11-15-1729-w2-2-retest

- **Phone:** [moto g96 5G](../../phone.md)
- **Build:** W2-2 ([builds.md](../../../../builds.md))
- **Source:** the plan file the tester read ("Phone re-test: wave 2, round
  2"), copied on 2026-11-16 with case IDs added and lightly edited. Its
  notes went outside the repo.

## Cases

- [MODEL-03](../../../../cases/local-models.md#model-03) Memory page: live line and Advanced
- [MODEL-02](../../../../cases/local-models.md#model-02) Two chats take turns: turn C reuses its saved state
- [CHECK-03](../../../../cases/checks.md#check-03) Stop on Home during the check's ACP part ends the whole check
- [MSG-07](../../../../cases/messages.md#msg-07) No start when the phone is short of memory
- [MSG-04](../../../../cases/messages.md#msg-04) A started agent that hangs is stopped and you are told
- [MSG-05](../../../../cases/messages.md#msg-05) A second wake within 10 min is held, with the reason
- [MSG-06](../../../../cases/messages.md#msg-06) Opening Gemini after that shows no exit 42
- [LIFE-03](../../../../cases/lifecycle.md#life-03) The notification never keeps an old chat's title

## Steps

App: "PhoneCanDo Full Dev" (`com.phonecando.app.full.dev`), new build
installed 17:28. Agents: Claude Code "A-04" and Codex "A-10" run on the
local Qwen3.5 0.8B; opencode "A-01" and Gemini CLI "A-05" use cloud models.
Keep the screen on (`adb shell svc power stayon usb`); never turn it off
(the phone has a lock only I can open). Set `stayon false` at the end.
Skip anything not listed. Budget: about 60 minutes.

### 1. Local model: two chats take turns (the main check)

1. (MODEL-03) Open the 0.8B's model page, then Memory. Note the live line
   and any line under it (expected, e.g., "Limited by free memory now: …").
   Under Advanced, note the Saved chats note (expected, e.g., "Auto: 2 · 1
   fits now") and Note size. Change nothing, and leave without saving.
2. (MODEL-02) Turn A: in Claude Code A-04, /clear, then send: Say hello in
   one short line. Wait for its answer.
3. Turn B: in Codex A-10, start a new chat (/new) and send: Say hello in
   one short line. Wait for its answer.
4. Turn C: back in A-04, same chat, send: Now say goodbye in one short
   line. Wait for its answer.

Every 3-5 minutes, read the end of the log
(`adb shell run-as com.phonecando.app.full.dev tail -c 2000 files/logs/model-server-qwen3-5-0-8b-q4-k-m.log`).
Note each "prompt eval time … / N tokens" line with its time and turn,
plus lines with "selected slot", "cache", "prompt", "checkpoint",
"exceeds", "removing", "forcing", "flash_attn". Save the whole log at the
end.

Expected: turn C reads only a small N (hundreds of tokens), not about
14,000. Before the fix, turn C read 14,398 and the log said "exceeds cache
size limit, skipping".

### 2. Check now: Stop ends the check (CHECK-03)

1. A-04 in its own app (Home shows its terminal). Open its page, then "What
   it can do", then "Check all again".
2. As soon as Home shows "Checking Claude Code" with STOP, tap STOP. The
   ACP part lasts only seconds, so be quick: check the screen right after
   starting.
3. Expected: no "PhoneCanDo check: reply with just the word done" prompt
   appears in A-04's own app afterwards; the check page reads "cancelled ·
   You stopped its check task…"; A-04 is back in its own app. If you missed
   the window, say so; don't retry more than twice.

### 3. Gemini: a waking message (MSG-07, MSG-04, MSG-05, MSG-06)

1. Check Gemini A-05's page: "Other agents can wake it" is on. A-05 should
   be stopped (stop it if not).
2. In opencode A-01 (a new session), send: Use the agents_send tool to send
   Gemini CLI the message "reply to me with the word hi" and let it wake
   them.
3. Watch for up to 6 minutes. Either Gemini answers (A-01 gets "hi"), or
   about 3 minutes after the start a notice says Gemini said nothing for 3
   minutes and was stopped. Note which, and the notice's text. Also read
   the last 15 logcat lines matching PhoneCanDoAcp, "went silent" or
   "session/load".
4. If it was stopped: send a second waking message the same way. The tool
   result should say it was not started because it failed under 10 minutes
   ago (with the reason).
5. Tap Gemini's notice (or open Gemini from the drawer). Its Home should
   open without "exit 42". If it asks you to trust a folder, DON'T answer:
   note the question and go Back. On its page, "What it can do": note the
   "Opens the ACP chat after" row and the ACP phone tools row (a "can't
   show its questions… trust this folder" note is expected if its tools
   didn't reach us).

### 4. Notification title (LIFE-03)

In A-04, after turn C, type /clear, then send: Say ok. Pull down the shade
(`adb shell cmd statusbar expand-notifications`, then a dump or
screenshot; collapse with `adb shell cmd statusbar collapse`). PhoneCanDo's
line for A-04 must not show the old chat's title. Don't scroll through my
personal notifications: look only at PhoneCanDo's.

### Report (under 500 words)

Per test: pass, fail or not tested, with what you saw; test 1's exact
prompt eval lines per turn and the cache/slot lines; any errors;
screenshots and why; agents and chats touched.
