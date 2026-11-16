---
round: 2026-11-15-1216-acp-two-chats-before
phone: moto-g96-5g
build: ACP
tester: Claude Opus 5.5, effort xhigh, an AI over adb
prompt: rebuilt (see prompt.md)
human_steps: none
started: 2026-11-15 12:16
ended: 2026-11-15 13:45
---

# Results: 2026-11-15-1216-acp-two-chats-before

Back-filled on 2026-11-16 from the old `phone-tests.md`, the tester's notes
and the model logs it saved. The 0.8B ran with a 64k context here
(`n_ctx_slot = 65536`).

## Results

| ID | Result | Trials | Evidence | What it saw |
|---|---|---|---|---|
| [MODEL-01](../../../../cases/local-models.md#model-01) | Pass | 1 | [MODEL-01.txt](evidence/MODEL-01.txt) | first request 14,401 tokens in 208 s, then 48 requests of 25-352 tokens each, all `selected slot by LCP similarity … f_keep = 1.000` |
| [MODEL-02](../../../../cases/local-models.md#model-02) | Fail | 1 | [MODEL-02.txt](evidence/MODEL-02.txt) | the bug: A 4,407 tokens; B `prompt state size 245.909 MiB exceeds cache size limit 180.000 MiB, skipping`, 9,831; C `211.786 MiB exceeds … skipping`, **14,398 tokens, 3 min 58 s** |

## Other things seen

- 12:16 the app showed a red box about `loadJSBundleFromAssets` (no
  `adb reverse`); after it, the screen stayed black on the splash until
  12:23, then an ANR at 12:24. Close app and a relaunch fixed it.
- In test 1 the 0.8B went off task: it hunted for "schedule_add" and asked 9
  permission questions (`ls`, `find`, and writes of
  `.claude/.projects/memory/schedule_add.txt`). No sub-agent showed. The
  file was removed on W2-1 in
  [2026-11-15-1509-w2-1-own-apps](../2026-11-15-1509-w2-1-own-apps/results.md).
- 13:24 the Models page hit a render error ("Cannot read property 'kvCache'
  of undefined"); JS from Metro was mid-change for wave 2. A JS reload
  cleared it.

## Left on the phone

A-04 in the chat of turns A and C; A-10 in the chat of turn B; the junk
file above; `stayon false` set at 13:45.

## Screenshots

About 60, most of them of Claude Code's terminal every 4 to 5 minutes
(its text is not in dumps), the rest of the drawer and Home. They stay
outside the repo.
