---
round: 2026-11-15-1911-w2-3-wake-burst
phone: moto-g96-5g
build: W2-3
tester: Claude Opus 5.5, effort xhigh, an AI over adb
prompt: rebuilt (see prompt.md)
human_steps: none
started: 2026-11-15 19:11
ended: 2026-11-15 19:29
---

# Results: 2026-11-15-1911-w2-3-wake-burst

Back-filled on 2026-11-16 from the old `phone-tests.md` and the tester's
notes. The tester ran the setup and test 1 to step 4. A-04 on the 0.8B was
still working on its answer at 19:29, so the rest of the plan ran in
[2026-11-15-1941-w2-3-final](../2026-11-15-1941-w2-3-final/results.md),
with a cloud-model agent in place of A-04 for steps 5 and 6.

## Results

| ID | Result | Trials | Evidence | What it saw |
|---|---|---|---|---|
| [MSG-08](../../../../cases/messages.md#msg-08) | Pass | 1 | [MSG-08.txt](evidence/MSG-08.txt) | A-01 → A-04. First result "woken: it was stopped; it starts in the background to read this. Its answer can take minutes (a local model may take several), so don't wait for it: end your turn, and its answer wakes you."; the other two "queued: it is starting"; all three delivered at the same instant, one 13,641-token prompt read |
| [MSG-09](../../../../cases/messages.md#msg-09) | Pass | 1 | [MSG-08.txt](evidence/MSG-08.txt) | A-04. The prompt read took 3 min 40 s; no "said nothing for 3 minutes" notice |
| [MSG-10](../../../../cases/messages.md#msg-10) | Not run | — | — | A-04's answer hadn't come by 19:29; ran in the next round with A-12 |
| [MSG-11](../../../../cases/messages.md#msg-11) | Not run | — | — | after MSG-10; ran in the next round |
| [MODEL-07](../../../../cases/local-models.md#model-07) | Not run | — | — | ran in the next round |
| [LIFE-04](../../../../cases/lifecycle.md#life-04) | Not run | — | — | ran in the next round |
| [BACK-01](../../../../cases/bring-back.md#back-01) | Not run | — | — | ran in the next round |
| [MODEL-08](../../../../cases/local-models.md#model-08) | Fail | 1 | [MODEL-08.txt](evidence/MODEL-08.txt) | not in the plan; seen while A-04 worked. Known limit: Claude Code's turn switched between its main chat (about 15k tokens) and a side request (about 9k). The server saves the outgoing chat before it loads the incoming one, and with room for one saved chat that save pushed out the chat it needed: 15,004 tokens read again (4 min) |

## Other things seen

- Opening the app started Gemini A-05, its active agent: its terminal
  showed an old scheduled-task prompt ("Reply with just the word ok.", from
  2026-11-14 20:33) in its input history. The tester stopped it.
- `uiautomator` dumps returned an old tree (Gemini's page "Running" after
  it stopped), so the tester used screenshots.
- `agents_list` with its default scope (the machine) listed only "opencode
  8"; A-01 then listed the whole phone and found Claude Code, canWake true.
- Each of the three Messages rows reads "delivered · started Claude Code",
  though there was one start.
- The notification's title changed to "reply" / "Claude Code · Working"
  while A-04 worked, then back to "1 chat" / "1 working · reading the
  prompt".

## Left on the phone

A-04 working on its answer (stopped at the start of the next round). A-01's
new session with the three sends.

## Screenshots

About 19, where dumps returned an old tree; they stay outside the repo.
