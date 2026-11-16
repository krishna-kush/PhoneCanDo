---
round: 2026-11-15-1509-w2-1-own-apps
phone: moto-g96-5g
build: W2-1
tester: Claude Opus 5.5, effort xhigh, an AI over adb
prompt: rebuilt (see prompt.md)
human_steps: none
started: 2026-11-15 15:09 (its first screenshot)
ended: 2026-11-15 15:30
---

# Results: 2026-11-15-1509-w2-1-own-apps

Back-filled on 2026-11-16 from the old `phone-tests.md` and the tester's
notes.

## Results

| ID | Result | Trials | Evidence | What it saw |
|---|---|---|---|---|
| [CHECK-02](../../../../cases/checks.md#check-02) | Pass | 1 | screen | check took about 15 s; A-04 back in its own app, same chat, "Check done · See results"; all 8 rows "just now" |
| [CHECK-03](../../../../cases/checks.md#check-03) | Fail | 2 | screen | Stop ended only the ACP turn, then the check sent its own-app prompt and left A-04 running. First try: STOP 3 s in gave "Claude Code finished. Opening it… / You stopped it.", then within about 15 s A-04 ran again and "Check done". Second try (15:29): STOP about 4 s in; 7 s later its own app got "PhoneCanDo check: reply with just the word done. Don't use any tools." Home's STOP shows only during the 1-2 s ACP turn |
| [CHECK-04](../../../../cases/checks.md#check-04) | Not run | — | — | PhoneCanDo's notification wasn't visible in the shade without scrolling past my personal ones |
| [LIFE-01](../../../../cases/lifecycle.md#life-01) | Pass | 1 | screen | note "An update stops the agent first and starts it again when done."; Claude Code 2.1.325 (387 MB, about 70 s, "up to date"); Home showed its terminal, not "stopped · Restart". The tester watched the Install page during the restart, not Home |
| [SCHED-04](../../../../cases/schedules.md#sched-04) | Pass | 1 | screen | A-01: "Scheduled task from the user (run now at 2026-11-15 15:24): …" (the tester asked A-01 to quote its task) |
| [SCHED-05](../../../../cases/schedules.md#sched-05) | Pass | 1 | screen | A-01: row "done · once, today 16:23", no next time; Recent runs "just now · opencode · started" |

## Other things seen

- The cleanup ran: `!rm` gave "Bash completed with no output", and `!ls`
  showed the memory folder empty. Claude Code then compacted its chat by
  itself, though its status line read "6300% until auto-compact".
- The Run now task shows no bubble of its own in opencode's chat; the reply
  sits under the earlier 14:27 turn, which showed "57m 2s".
- Before the schedule was deleted, its row still said "last: started · 2
  min ago" though the run had finished.

## Left on the phone

A-04 active on Home, running. Gemini A-05's wake switch back on. The test
schedule deleted ("Its past runs stay in the list"). An extra message in
A-01's newest session: the tester's request to quote the task. `stayon
false` set.

## Screenshots

About 45, for Home during the checks, the drawer and agent pages; they stay
outside the repo.
