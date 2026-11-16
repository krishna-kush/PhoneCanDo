---
round: 2026-11-15-1347-w2-1-first
phone: moto-g96-5g
build: W2-1
tester: Claude Opus 5.5, effort xhigh, an AI over adb
prompt: rebuilt (see prompt.md)
human_steps: I approved the delete of models.json; I unlocked the phone after the screen went off; I stopped the tester at 15:06
started: 2026-11-15 13:47
ended: 2026-11-15 15:06
---

# Results: 2026-11-15-1347-w2-1-first

Back-filled on 2026-11-16 from the old `phone-tests.md` and the tester's
notes. The tester did parts 0, A, C and D; I stopped it at 15:06 during
turn B. Part B and the cleanup ran next, in
[2026-11-15-1509-w2-1-own-apps](../2026-11-15-1509-w2-1-own-apps/results.md).

## Results

| ID | Result | Trials | Evidence | What it saw |
|---|---|---|---|---|
| [MODEL-06](../../../../cases/local-models.md#model-06) | Pass | 1 | screen | "The list of models on the phone is damaged"; after deleting `models.json` the downloads finished in seconds (the files were still there). A-04 still pointed to the 0.8B. I approved the delete on the PC |
| [MODEL-03](../../../../cases/local-models.md#model-03) | Fail | 1 | screen | the live line read "context 32k · no chats saved" with about 1 GB for Less, Normal and More alike (only the GB moved), while Advanced said "Saved chats: Auto: 2". Not in the old `phone-tests.md`; added from the notes |
| [MODEL-05](../../../../cases/local-models.md#model-05) | Pass | 1 | screen | "Detailed log" off, note "… Changing it restarts the model." Left off |
| [MODEL-04](../../../../cases/local-models.md#model-04) | Pass | 1 | screen | "context 32k · no chats saved · half-size notes · 3.6 GB" |
| [MODEL-02](../../../../cases/local-models.md#model-02) | Fail | 1 | [MODEL-02.txt](evidence/MODEL-02.txt) | 0.8B planned at 32k with `--cache-ram 88` MiB. B: `245.956 MiB exceeds cache size limit 88.000 MiB, skipping`. Not enough free RAM for one saved chat at full size. I stopped the tester during turn B, so turn C did not run |
| [LIFE-02](../../../../cases/lifecycle.md#life-02) | Pass | 1 | [LIFE-02.txt](evidence/LIFE-02.txt) | logcat `PhoneCanDoPower` "holding the CPU awake for work", never "letting the CPU sleep". I unlocked the phone after the screen went off |
| [CHECK-02](../../../../cases/checks.md#check-02) | Not run | — | — | part B ran in the next round |
| [CHECK-03](../../../../cases/checks.md#check-03) | Not run | — | — | part B ran in the next round |
| [CHECK-04](../../../../cases/checks.md#check-04) | Not run | — | — | part B ran in the next round |
| [LIFE-01](../../../../cases/lifecycle.md#life-01) | Not run | — | — | part B ran in the next round |
| [LIFE-03](../../../../cases/lifecycle.md#life-03) | Not run | — | — | not reached on W2-1; it ran on W2-2 |
| [SCHED-04](../../../../cases/schedules.md#sched-04) | Not run | — | — | part B ran in the next round |
| [SCHED-05](../../../../cases/schedules.md#sched-05) | Not run | — | — | part B ran in the next round |
| [PAGE-01](../../../../cases/app-pages.md#page-01) | Pass | 1 | screen | `input text hello` on Settings and with the drawer open: opencode's box stayed empty. Right after the drawer closed, "hi" went nowhere until a tap on the box |
| [PAGE-02](../../../../cases/app-pages.md#page-02) | Pass | 1 | screen | Codex "Messages · delivered", "Schedules · starts it" |
| [PAGE-03](../../../../cases/app-pages.md#page-03) | Pass | 1 | screen | Gemini "In ACP mode: …"; Qwen Code "Not working: it wakes only in ACP mode, which isn't working" |
| [PAGE-04](../../../../cases/app-pages.md#page-04) | Pass | 1 | screen | muted "We saw its ACP mode fail…" under the switch (A-14) |
| [MSG-02](../../../../cases/messages.md#msg-02) | Pass | 1 | screen | A-01 → A-05. Result "woken (it was stopped, now starting in the background…)"; Messages "delivered · started Gemini CLI" |
| [MSG-04](../../../../cases/messages.md#msg-04) | Fail | 1 | [MSG-04.txt](evidence/MSG-04.txt) | A-01 → A-05. Gemini sat 12 min at 0% CPU, then "Stopped with an error"; its page then read a false "exit 42" |
| [MSG-03](../../../../cases/messages.md#msg-03) | Pass | 1 | screen | A-01 → A-05. "could not be woken… queued… canWake: false" (from A-01's summary: the raw tool result wasn't in the dump); Messages "waiting" |
| [BACK-01](../../../../cases/bring-back.md#back-01) | Not run | — | — | part E not reached |
| [LIFE-04](../../../../cases/lifecycle.md#life-04) | Not run | — | — | part E not reached |

## Other things seen

- 13:48 Home showed A-04 "Claude Code could not start / start_failed:
  corrupt models.json" before step 0.2: the old list, as expected.
- 13:48 a tester mistake: Back left the app, and its next tap opened
  another app from the launcher. Nothing ran.
- The tester's first try at step 0.2 was refused by the session's
  permission check; I approved it, and it ran at 14:34.
- After that relaunch, the app stayed on the splash, with two ANRs (14:36,
  14:37); `adb reverse` again and a relaunch fixed it.
- Metro's "Refreshing..." banner showed at 14:08, 14:20, 14:54 and about
  15:04: the JS changed during the test.
- The header tap missed the drawer twice while the keyboard was up.
- A-01 first sent to "Gemini CLI A-05", a name that doesn't exist, and used
  the only Gemini agent.

## Left on the phone

Gemini A-05's wake switch off (put back on in the next round). Turn B
(Codex A-10) still running at 15:06. Chats touched: a new A-01 session
(part D, and its resend); A-04's chat after /clear (turn A); A-10's earlier
chat, reopened, then a new one with /new. `stayon false` set.

## Screenshots

About 70, for the drawer, Home, agent and model pages, where dumps fail. At
14:04 I asked for fewer. They stay outside the repo.
