# Status

The latest result of every case, one column per phone. Each result says
its build and date, and links to the round that got it. A case's own page
says how to run it; search its ID to find every round that ran it.

Results: **Pass**, **Fail**, **Flaky** (tries on one build disagree),
**Blocked** (the tester couldn't finish it), **Not run**, and **Fixed** (a
Pass after a Fail on an earlier build). An AI ran every result here: read
the warning in [README.md](README.md).

After each round, change only the cells of the cases that round ran.

## ACP mode

| ID | Test | moto g96 5G |
|---|---|---|
| [ACP-01](cases/acp.md#acp-01) | Claude Code checks in ACP mode with the check model | [Pass, ACP, 11-14](phones/moto-g96-5g/rounds/2026-11-14-1423-acp-first-look/results.md) |
| [ACP-02](cases/acp.md#acp-02) | Back on its own model after a check | [Pass, ACP, 11-14](phones/moto-g96-5g/rounds/2026-11-14-1423-acp-first-look/results.md) |
| [ACP-03](cases/acp.md#acp-03) | Kinds without ACP mode still work as before | [Pass, ACP, 11-14](phones/moto-g96-5g/rounds/2026-11-14-1423-acp-first-look/results.md) |
| [ACP-04](cases/acp.md#acp-04) | A message wakes an idle Claude Code (app in the background) into ACP | [Pass, ACP, 11-14](phones/moto-g96-5g/rounds/2026-11-14-1647-acp-regression/results.md) |
| [ACP-05](cases/acp.md#acp-05) | Stop on the background view | [Pass, ACP, 11-14](phones/moto-g96-5g/rounds/2026-11-14-1647-acp-regression/results.md) |
| [ACP-06](cases/acp.md#acp-06) | Deny a permission question | [Pass, ACP, 11-14](phones/moto-g96-5g/rounds/2026-11-14-1647-acp-regression/results.md) |
| [ACP-07](cases/acp.md#acp-07) | Allow a permission question, Stop, messages, every schedule case (incl. the waiting-hook wake) | [Pass, ACP, 11-15](phones/moto-g96-5g/rounds/2026-11-15-0321-acp-morning/results.md) |
| [ACP-08](cases/acp.md#acp-08) | A failed ACP start of a prompt-taking kind runs the task in its own app | [Pass, ACP, 11-15](phones/moto-g96-5g/rounds/2026-11-15-0321-acp-morning/results.md) |
| [ACP-09](cases/acp.md#acp-09) | Gemini: ACP start and message delivery | [Pass, ACP, 11-15](phones/moto-g96-5g/rounds/2026-11-15-0321-acp-morning/results.md) |
| [ACP-10](cases/acp.md#acp-10) | The "trust its folder" wording on a finished ACP turn without phone tools | Not run |
| [ACP-11](cases/acp.md#acp-11) | Pi in ACP mode | Not run |
| [ACP-12](cases/acp.md#acp-12) | A custom agent with its own ACP command | Not run |

## Capability checks

| ID | Test | moto g96 5G |
|---|---|---|
| [CHECK-01](cases/checks.md#check-01) | Check now on new agents of other kinds | [Pass, ACP, 11-15](phones/moto-g96-5g/rounds/2026-11-15-0321-acp-morning/results.md) |
| [CHECK-02](cases/checks.md#check-02) | Check now starts an agent that ran in its own app again afterwards | [Pass, W2-1, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1509-w2-1-own-apps/results.md) |
| [CHECK-03](cases/checks.md#check-03) | Stop on Home during the check's ACP part ends the whole check | [Fixed, W2-2, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1729-w2-2-retest/results.md) |
| [CHECK-04](cases/checks.md#check-04) | The notification's Stop during a check | Not run |
| [CHECK-05](cases/checks.md#check-05) | A guessed stop after Esc | Not run |

## Schedules

| ID | Test | moto g96 5G |
|---|---|---|
| [SCHED-01](cases/schedules.md#sched-01) | A schedule while the agent is busy waits, then runs | [Pass, ACP, 11-14](phones/moto-g96-5g/rounds/2026-11-14-1647-acp-regression/results.md) |
| [SCHED-02](cases/schedules.md#sched-02) | opencode schedule runs as before | [Pass, ACP, 11-14](phones/moto-g96-5g/rounds/2026-11-14-1647-acp-regression/results.md) |
| [SCHED-03](cases/schedules.md#sched-03) | A scheduled task with the app closed | [Fixed, ACP, 11-15](phones/moto-g96-5g/rounds/2026-11-15-0321-acp-morning/results.md) |
| [SCHED-04](cases/schedules.md#sched-04) | Run now reads "(run now at …)" with its time | [Pass, W2-1, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1509-w2-1-own-apps/results.md) |
| [SCHED-05](cases/schedules.md#sched-05) | Run now marks a once schedule done | [Pass, W2-1, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1509-w2-1-own-apps/results.md) |

## Agent messages

| ID | Test | moto g96 5G |
|---|---|---|
| [MSG-01](cases/messages.md#msg-01) | Wake switch off keeps a message queued; on again wakes | [Pass, ACP, 11-14](phones/moto-g96-5g/rounds/2026-11-14-1647-acp-regression/results.md) |
| [MSG-02](cases/messages.md#msg-02) | A waking message starts a stopped agent | [Pass, W2-1, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1347-w2-1-first/results.md) |
| [MSG-03](cases/messages.md#msg-03) | Waking switched off: not started, told why | [Pass, W2-1, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1347-w2-1-first/results.md) |
| [MSG-04](cases/messages.md#msg-04) | A started agent that hangs is stopped and you are told | [Fixed, W2-2, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1729-w2-2-retest/results.md) |
| [MSG-05](cases/messages.md#msg-05) | A second wake within 10 min is held, with the reason | [Pass, W2-2, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1729-w2-2-retest/results.md) |
| [MSG-06](cases/messages.md#msg-06) | Opening Gemini after that shows no exit 42 | [Pass, W2-2, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1729-w2-2-retest/results.md) |
| [MSG-07](cases/messages.md#msg-07) | No start when the phone is short of memory | [Pass, W2-2, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1729-w2-2-retest/results.md) |
| [MSG-08](cases/messages.md#msg-08) | A burst of 3 waking messages to a stopped agent gives one start and one prompt | [Pass, W2-3, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1911-w2-3-wake-burst/results.md) |
| [MSG-09](cases/messages.md#msg-09) | A local-model agent woken by a message is not stopped while its model reads the prompt | [Pass, W2-3, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1911-w2-3-wake-burst/results.md) |
| [MSG-10](cases/messages.md#msg-10) | An answer to a waking message wakes the agent that asked | [Pass, W2-3, 11-16](phones/moto-g96-5g/rounds/2026-11-15-1941-w2-3-final/results.md) |
| [MSG-11](cases/messages.md#msg-11) | A reply to that answer doesn't wake anyone (hop limit) | [Pass, W2-3, 11-16](phones/moto-g96-5g/rounds/2026-11-15-1941-w2-3-final/results.md) |
| [MSG-12](cases/messages.md#msg-12) | A waking message to an agent that looks busy says why it didn't wake | [Fail, W2-3, 11-16](phones/moto-g96-5g/rounds/2026-11-15-1941-w2-3-final/results.md) |

## Agent lifecycle

| ID | Test | moto g96 5G |
|---|---|---|
| [LIFE-01](cases/lifecycle.md#life-01) | Update agent says it starts the agent again, and does | [Pass, W2-1, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1509-w2-1-own-apps/results.md) |
| [LIFE-02](cases/lifecycle.md#life-02) | The CPU stays awake while a long local turn works, screen off | [Pass, W2-1, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1347-w2-1-first/results.md) |
| [LIFE-03](cases/lifecycle.md#life-03) | The notification never keeps an old chat's title | [Pass, W2-2, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1729-w2-2-retest/results.md) |
| [LIFE-04](cases/lifecycle.md#life-04) | Quitting an agent's own app on purpose gives no "stopped by itself" notice | [Pass, W2-3, 11-16](phones/moto-g96-5g/rounds/2026-11-15-1941-w2-3-final/results.md) |

## Bring back cut-off runs

| ID | Test | moto g96 5G |
|---|---|---|
| [BACK-01](cases/bring-back.md#back-01) | A run cut off by a reboot is offered back, and Continue goes on in the same chat | [Pass, W2-3, 11-16](phones/moto-g96-5g/rounds/2026-11-15-1941-w2-3-final/results.md) |
| [BACK-02](cases/bring-back.md#back-02) | Android killing the app is offered back | [Fail, W2-3, 11-16](phones/moto-g96-5g/rounds/2026-11-15-1941-w2-3-final/results.md) |
| [BACK-03](cases/bring-back.md#back-03) | Dismiss, or a later reboot, gives no notice | Not run |
| [BACK-04](cases/bring-back.md#back-04) | A force stop gives no notice | Not run |
| [BACK-05](cases/bring-back.md#back-05) | A cancelled installer gives no notice | Not run |
| [BACK-06](cases/bring-back.md#back-06) | Continue on a Claude Code (TUI) or ACP run | Not run |

## Local models

| ID | Test | moto g96 5G |
|---|---|---|
| [MODEL-01](cases/local-models.md#model-01) | One chat alone reuses its prompt | [Pass, ACP, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1216-acp-two-chats-before/results.md) |
| [MODEL-02](cases/local-models.md#model-02) | Two chats take turns: turn C reuses its saved state | [Fail, W2-4, 11-16](phones/moto-g96-5g/rounds/2026-11-16-0750-w2-4-chat-storage/results.md) |
| [MODEL-03](cases/local-models.md#model-03) | Memory page: live line and Advanced | [Fixed, W2-2, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1729-w2-2-retest/results.md) |
| [MODEL-04](cases/local-models.md#model-04) | Memory page for the 4B | [Pass, W2-1, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1347-w2-1-first/results.md) |
| [MODEL-05](cases/local-models.md#model-05) | Detailed log switch is there, off, with its note | [Pass, W2-1, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1347-w2-1-first/results.md) |
| [MODEL-06](cases/local-models.md#model-06) | New model list format: old list read as damaged; delete and download again | [Pass, W2-1, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1347-w2-1-first/results.md) |
| [MODEL-07](cases/local-models.md#model-07) | Saving a Memory page change, then setting it back | [Pass, W2-3, 11-16](phones/moto-g96-5g/rounds/2026-11-15-1941-w2-3-final/results.md) |
| [MODEL-08](cases/local-models.md#model-08) | One agent's own turn switching between two prompts | [Fail (known limit), W2-3, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1911-w2-3-wake-burst/results.md) |
| [MODEL-09](cases/local-models.md#model-09) | Saving a Memory page change while an agent runs on the model | Not run |
| [MODEL-10](cases/local-models.md#model-10) | The detailed log switch turned on | Not run |
| [MODEL-11](cases/local-models.md#model-11) | Sliding-window models | Not run |
| [MODEL-12](cases/local-models.md#model-12) | The 4B actually serving with half-size notes | Not run |
| [MODEL-13](cases/local-models.md#model-13) | Chats that take turns come back from storage | [Fail, W2-4, 11-16](phones/moto-g96-5g/rounds/2026-11-16-0750-w2-4-chat-storage/results.md) |
| [MODEL-14](cases/local-models.md#model-14) | Saved chat files are private to the app | [Pass, W2-4, 11-16](phones/moto-g96-5g/rounds/2026-11-16-0750-w2-4-chat-storage/results.md) |
| [MODEL-15](cases/local-models.md#model-15) | Each model's memory is measured, and the Memory page says so | [Pass, W2-4, 11-16](phones/moto-g96-5g/rounds/2026-11-16-0750-w2-4-chat-storage/results.md) |

## App pages

| ID | Test | moto g96 5G |
|---|---|---|
| [PAGE-01](cases/app-pages.md#page-01) | Keys typed with a page or the drawer open don't reach opencode's page | [Pass, W2-1, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1347-w2-1-first/results.md) |
| [PAGE-02](cases/app-pages.md#page-02) | New agent shows Codex as "Messages · delivered" | [Pass, W2-1, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1347-w2-1-first/results.md) |
| [PAGE-03](cases/app-pages.md#page-03) | "Woken while idle" for ACP-only kinds | [Pass, W2-1, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1347-w2-1-first/results.md) |
| [PAGE-04](cases/app-pages.md#page-04) | Wake switch stays, with a line when its wake failed | [Pass, W2-1, 11-15](phones/moto-g96-5g/rounds/2026-11-15-1347-w2-1-first/results.md) |
| [PAGE-05](cases/app-pages.md#page-05) | Custom agent form | [Pass, ACP, 11-14](phones/moto-g96-5g/rounds/2026-11-14-1423-acp-first-look/results.md) |

## Next to test

The next round picks from here:

- Every Fail above, once its fix is in a build.
- Bring back: [BACK-03](cases/bring-back.md#back-03),
  [BACK-04](cases/bring-back.md#back-04),
  [BACK-05](cases/bring-back.md#back-05) and
  [BACK-06](cases/bring-back.md#back-06).
- Saving a Memory page change while an agent runs on the model:
  [MODEL-09](cases/local-models.md#model-09).
- A known gap, which would fail today (see its note):
  [CHECK-05](cases/checks.md#check-05) (a guessed stop after Esc).
- Lower priority, covered by unit tests:
  [CHECK-04](cases/checks.md#check-04) (the notification's Stop during a
  check), [MODEL-10](cases/local-models.md#model-10) (the detailed log
  switch turned on), [ACP-10](cases/acp.md#acp-10) (the "trust its
  folder" wording), [MODEL-11](cases/local-models.md#model-11)
  (sliding-window models, none on the phone),
  [MODEL-12](cases/local-models.md#model-12) (the 4B serving with
  half-size notes), [ACP-11](cases/acp.md#acp-11) (Pi in ACP mode) and
  [ACP-12](cases/acp.md#acp-12) (a custom agent with its own ACP command).

## Open issues found by these tests

The app's are also in `docs/planning/todo.md` (ACP mode, found by the
phone tests), the local-model ones in `lme/docs/planning/todo.md`.

- Claude Code on a local model compacted its chat at once in turn C
  ([MODEL-02](cases/local-models.md#model-02), W2-4): 3,817 tokens written
  in 9.3 min, then a new 16,787-token prompt read in 6.5 min, so the turn
  took 17 min although its chat came back from storage in 1.3 s. Now the
  biggest slowdown left (`docs/planning/todo.md`).
- The 4B's Suggested card says it fits (3.6 GB) while its model page says
  "Too big for this phone" (4.1 GB, measured): the two use different sums
  (`lme/docs/planning/todo.md`, Open questions).
- Claude Code on a local model compacted its chat at about 16k of a 32k
  context, and the compaction request read the whole prompt again (14,875
  tokens). Seen in [MODEL-02](cases/local-models.md#model-02) on W2-2.
- Since W2-4, chats that take turns are kept on storage (up to 4 per
  model, [MODEL-13](cases/local-models.md#model-13)). That replaced two
  limits of the saved chats in RAM, which still hold on a phone short of
  storage: with one saved chat (8 GB phones) a third chat pushed the saved
  one out (seen on 11-15: `making room for prompt cache entry, removing
  oldest entry`, during [LIFE-03](cases/lifecycle.md#life-03) on W2-2),
  and two prompts taking turns needed room for two saved chats, since the
  server saves the outgoing chat before it loads the incoming one
  ([MODEL-08](cases/local-models.md#model-08)).
- An opencode chat that gets a message without a run (a reply that may not
  wake it) stays on "Working": the notification sticks, the wake lock stays
  held, later waking messages see it as busy, and a later cut-off offers it
  back falsely ([MSG-12](cases/messages.md#msg-12),
  [BACK-02](cases/bring-back.md#back-02)). Fixed in W2-4 (opencode's inbox
  events no longer count as working, and its working chats are checked
  against its server); not run again yet.
- An em dash in an `agents_send` text is stored as three replacement
  characters, so the Messages page shows "Got it ��� thanks" (seen in
  [MSG-11](cases/messages.md#msg-11)). Fixed in W2-4 (bridge bodies read
  as UTF-8); not run again yet.
- A woken opencode turn can land in an old session, which then shows a
  duration like "4,651m 37s" (seen in [MSG-10](cases/messages.md#msg-10)).
- A Run now task in opencode shows no bubble of its own; the reply sits
  under the earlier turn ([SCHED-04](cases/schedules.md#sched-04)).
- After the drawer closes, keys typed on Home reach opencode's box only
  after a tap. The header tap sometimes misses the drawer while the
  keyboard is up ([PAGE-01](cases/app-pages.md#page-01)).
- Check records are kept per kind, so one agent's failed check lowers a
  newer agent's level.
- `uiautomator dump` fails on the drawer, Home, agent pages and model pages
  ("could not get idle state"), so testers need screenshots there.
