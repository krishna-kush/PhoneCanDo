---
round: 2026-11-15-1729-w2-2-retest
phone: moto-g96-5g
build: W2-2
tester: Claude Opus 5.5, effort xhigh, an AI over adb
prompt: rebuilt (see prompt.md)
human_steps: I watched the phone and told the tester why turn C read the prompt again
started: 2026-11-15 17:29
ended: 2026-11-15 18:35
---

# Results: 2026-11-15-1729-w2-2-retest

Back-filled on 2026-11-16 from the old `phone-tests.md`, the tester's notes
and the model log it saved. Test 3 ran after test 4, to free RAM.

## Results

| ID | Result | Trials | Evidence | What it saw |
|---|---|---|---|---|
| [MODEL-03](../../../../cases/local-models.md#model-03) | Pass | 1 | screen | "On this phone: context 32k · 1 chat saved · half-size notes · 1.2 GB", then "Limited by free memory now: stopping other agents or apps gives it more." Saved chats "Auto: 2 · 1 fits now"; Note size "Auto … half now"; Snapshots and CPU threads Auto 4 |
| [MODEL-02](../../../../cases/local-models.md#model-02) | Pass | 1 | [MODEL-02.txt](evidence/MODEL-02.txt) | A 14,376 tokens / 340 s; B 9,664 / 184 s; C **1,384 tokens / 65 s**, no "exceeds" line. Claude Code then compacted the chat by itself, and that request read 14,875 tokens again (see open issues in [status.md](../../../../status.md)). I saw on the phone that it was reading the prompt after compacting |
| [CHECK-03](../../../../cases/checks.md#check-03) | Pass | 2 | screen | Cancel check during the ACP part: "cancelled · You cancelled it.", no own-app prompt, A-04 back in its own app. The ACP part takes under 10 s, so the tester used the check page's Cancel, not Home's Stop. Its first try missed: the whole check ended within about 10 s |
| [MSG-07](../../../../cases/messages.md#msg-07) | Pass | 2 | [MSG-07.txt](evidence/MSG-07.txt) | A-01 → A-05. "not started: the phone is short of memory" until the tester stopped A-04 (MemAvailable rose to 3.0 GB) |
| [MSG-04](../../../../cases/messages.md#msg-04) | Pass | 1 | [MSG-04.txt](evidence/MSG-04.txt) | A-01 → A-05. After 3 min: "It said nothing for 3 minutes, so we stopped it. Open it: it may be waiting for you there (to sign in or to trust its folder), or it hit a usage limit." |
| [MSG-05](../../../../cases/messages.md#msg-05) | Pass | 1 | [MSG-05.txt](evidence/MSG-05.txt) | A-01 → A-05. "not started: it failed under 10 minutes ago (its last turn said nothing for 3 minutes, so we stopped it)" |
| [MSG-06](../../../../cases/messages.md#msg-06) | Pass | 1 | screen | A-05. Its Home showed "Do you trust the files in this folder?"; the tester left it unanswered. The old "exit 42" row stays until the next Check now |
| [LIFE-03](../../../../cases/lifecycle.md#life-03) | Pass | 1 | [LIFE-03.txt](evidence/LIFE-03.txt) | A-04. After /clear: "New chat · Claude Code · Working / Qwen3.5-0.8B · reading the prompt, 14%" |

## Other things seen

- Turn C's answer was "Hello!", though it asked for goodbye, after 9 min
  27 s in all (the compaction's re-read).
- During LIFE-03's "Say ok", the model server pushed saved chats out
  ("making room for prompt cache entry, removing oldest entry") and read
  the prompt from the start again. See the open issues in
  [status.md](../../../../status.md).
- After CHECK-03, A-04's What it can do went from "8 checked" to "7
  checked · 1 not working".
- The ACP phone tools row on A-05 read "Checked with 0.67.0 · yesterday
  14:32", with no trust-folder note.
- No `session/load` lines in logcat during test 3.

## Left on the phone

A-01 running; A-05 running at its folder-trust question (not answered);
A-04 stopped mid "Say ok" to free RAM; A-10 stopped. Chats touched: A-04's
chat (turns A and C, then /clear and "Say ok"); a new A-10 chat (/new); a
new A-01 session for test 3. `stayon false` set.

## Screenshots

5, for Home and Gemini's Home, where dumps fail; they stay outside the
repo.
