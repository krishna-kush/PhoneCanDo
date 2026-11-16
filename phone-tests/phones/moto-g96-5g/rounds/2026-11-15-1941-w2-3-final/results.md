---
round: 2026-11-15-1941-w2-3-final
phone: moto-g96-5g
build: W2-3
tester: Claude Opus 5.5, effort xhigh, an AI over adb; the session that started it finished test 4
prompt: rebuilt (see prompt.md)
human_steps: I unlocked the phone after the reboot
started: 2026-11-15 19:41
ended: 2026-11-16 04:05
---

# Results: 2026-11-15-1941-w2-3-final

Back-filled on 2026-11-16 from the old `phone-tests.md`, the tester's notes
and the shade dumps of the reboot test. At 20:01 the tester was ready to
reboot, but the reboot didn't happen that evening. The dev app's process
died overnight; on 2026-11-16 the long task ran again and the reboot ran at
03:51.

## Results

| ID | Result | Trials | Evidence | What it saw |
|---|---|---|---|---|
| [MSG-10](../../../../cases/messages.md#msg-10) | Pass | 1 | [MSG-10.txt](evidence/MSG-10.txt) | A-01 → A-12 → A-01. 44 sent 19:45:31 with wake; A-12 started 19:45:34; its "hi" (45, replyTo 44, hop 1) came 19:45:38 and woke A-01 straight away; Messages "delivered · woke opencode" |
| [MSG-11](../../../../cases/messages.md#msg-11) | Pass | 1 | [MSG-11.txt](evidence/MSG-11.txt) | A-01 → A-12. A-01's own thank-you in its woken turn (46, replyTo 45) logged hop 2 and was delivered with woke false |
| [MODEL-07](../../../../cases/local-models.md#model-07) | Pass | 1 | screen | Saved chats 1 then Save: button "MEMORY: NORMAL · 1 SET"; back to Auto then Save: "MEMORY: NORMAL"; no errors (no agent ran on the model, so no restart note) |
| [LIFE-04](../../../../cases/lifecycle.md#life-04) | Pass | 1 | screen | ^C twice on the extra keys quit Claude Code ("Claude Code stopped", RESTART); no notice in the next 2 minutes. `input keycombination 113 31` did nothing |
| [BACK-01](../../../../cases/bring-back.md#back-01) | Pass | 1 | [BACK-01.txt](evidence/BACK-01.txt) | A-01 mid-turn on "Ten sequential sleep 100 runs"; `adb reboot` 03:51; I unlocked the phone; the notice read "opencode: cut off mid-task / The phone restarted while it worked on "Ten sequential sleep 100 runs". Continue in the same chat?"; Continue at 04:04:36; A-01 then showed "Ten sequential sleep 100 runs · opencode · Working" and its session list showed that chat busy. The PhoneCanDo note inside the chat was not looked at |
| [MSG-12](../../../../cases/messages.md#msg-12) | Fail | 1 | [MSG-12.txt](evidence/MSG-12.txt) | not in the plan; seen in MSG-11's step. 47 (wake true) to A-12, idle but stuck on "Working" (see open issues in [status.md](../../../../status.md)), was delivered with woke false and no reason |
| [BACK-02](../../../../cases/bring-back.md#back-02) | Fail | 1 | [BACK-02.txt](evidence/BACK-02.txt) | not in the plan; seen on 11-16. The dev app's process died overnight; on the next start a notice offered "opencode 8: cut off mid-task / Android closed PhoneCanDo while it worked on "Send pong message to opencode agent"", but A-12 was idle: its chat was stuck on "Working" (see open issues). The mechanism fired; the record was false |

## Other things seen

- A-01's first send went to "opencode 8@machine" and was refused ("no
  agent is named opencode 8@machine; agents here: …"); its second, to
  "opencode 8", worked.
- An em dash in A-01's thank-you was stored as three replacement
  characters, so Messages shows "Got it ��� thanks".
- Message 47 logged hop 0, while 46 (the same reply chain) logged hop 2.
- The phone's keyboard autocorrected "replyTo" to "reply to" in the
  tester's prompt; A-01 still used replyTo.
- From 19:52:41 a notification read "Send pong message to opencode agent —
  opencode 8 · Working", though A-12 was idle: its chat showed two
  "From another agent or a schedule" items (46, 47) and no new turn. Its
  answer turn showed a duration of "4,651m 37s" (an old session).
- MODEL-07: after Saved chats 1, the hint read "none fit now"; the live
  line stayed "context 32k · no chats saved · 1 GB". The model was not
  loaded, so no restart and no "next start" note.
- LIFE-04: the first ^C pair stopped a "Compacting conversation…" turn;
  the second pair quit Claude Code.
- 03:19 on 11-16 the phone was on the launcher with the dev app's process
  gone (no reboot: uptime 1 day), and `adb reverse` was empty.
- A-01's first ten-`sleep 100` run ended (03:38 to 03:42) before the go to
  reboot, so it ran again from 03:43:20.

## Left on the phone

A-01 working on the continued chat after Continue. A-12's false cut-off
notice not tapped. Chats touched: new A-01 sessions for MSG-10 (and the
"thanks"), the loop and the two `sleep 100` runs; A-12's chat (its "hi"
and the messages that reached it).

## Screenshots

About 70 (Home, the drawer, agent pages, the terminal for LIFE-04), plus 2
after Continue; they stay outside the repo.
