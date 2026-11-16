---
round: 2026-11-16-0750-w2-4-chat-storage
phone: moto-g96-5g
build: W2-4
tester: Claude Opus 5.5, effort xhigh, an AI over adb; a first tester ran 07:58-08:24, a second one continued from its notes at 09:12
prompt: prompt.md (the second tester's prompt added a paragraph: continue from the first one's notes, use the phone only for what they leave unclear)
human_steps: I stopped the first tester and disconnected the phone at about 08:24, during the round
started: 2026-11-16 07:50
ended: 2026-11-16 09:26
---

# Results: 2026-11-16-0750-w2-4-chat-storage

The first tester ran MODEL-15 and MODEL-02/MODEL-13's three turns from 07:58
to 08:24, when I stopped it and disconnected the phone. Turn C was still
running then; it ended at 08:30 with no tester watching. A second tester
continued at 09:12 from the first one's notes, logs and screenshots: it ran
no turns, re-read the model's log and listed the saved chats again for
MODEL-14. The plan allowed no human steps and about 30 minutes.

## Results

| ID | Result | Trials | Evidence | What it saw |
|---|---|---|---|---|
| [MODEL-15](../../../../cases/local-models.md#model-15) | Pass | 1 | [MODEL-15.txt](evidence/MODEL-15.txt) | Both models measured at 07:58:49, 9 s after the app opened: 0.8B "measured at 41984 (f16) … copied 549 MiB", 4B "measured at 16384 (q8_0) … copied 2778 MiB". 0.8B Memory: "On this phone: context 32k · chats on storage · 1.4 GB" (no "about"), "Chats that take turns are kept on storage (up to 4), so switching between them takes about a second." 4B, as is: "Needs 4.1 GB of RAM; this phone can spare 3.9 GB.", "Too big for this phone"; its measured parts add up to 3697 MiB |
| [MODEL-02](../../../../cases/local-models.md#model-02) | Fail | 1 | [MODEL-02.txt](evidence/MODEL-02.txt) | Turn A read 14,376 tokens (215 s), turn B 9,664 (138 s). At turn C A-04's chat came back from storage and the first request read only the 1,377 tokens past it (35 s). But A-04 showed "✻ Compacting conversation… (1m 52s)" from the send; a second request read 600 and wrote 3,817 tokens (9.3 min), and the answer came from a new prompt read from the start: 16,787 tokens in 391 s, done 08:30:07, 17 minutes after the send. No "exceeds cache size limit" line |
| [MODEL-13](../../../../cases/local-models.md#model-13) | Fail | 1 | [MODEL-13.txt](evidence/MODEL-13.txt) | Storage held: at turn B "chat a0518cde kept on storage" (08:09:38, 3 s after the send); at turn C "chat 64f9d3df kept on storage", then "chat a0518cde loaded back from storage" (08:13:07.050, 1.3 s after the send), and the model's log "restored 3 context checkpoint(s)". The read did not: turn C's first read was 1,377 tokens in 35.4 s, not a few dozen, and its output began only after that, while Claude Code was compacting (see MODEL-02) |
| [MODEL-14](../../../../cases/local-models.md#model-14) | Pass | 2 | [MODEL-14.txt](evidence/MODEL-14.txt) | 08:24: two `.bin` files. 09:14, after the server's last save (to a `.tmp` at 08:32:19) and its exit: three `.bin` files. Each "-rw-------", the folder "drwx------", no `.tmp` in either listing; also a 120-byte `shape` file, "-rw-------" |

## Other things seen

- 08:13-08:30: Claude Code (A-04) compacted its conversation at turn C, at
  about 15,800 tokens of a 32k context. It already showed "6297% until
  auto-compact" by its input box after turn A (08:12:58, and again at
  08:14:59). The compaction took about 10 minutes of writing plus a full
  16,787-token read, so turn C took 17 minutes although the saved chat came
  back in about a second.
- 08:00-08:01 (first tester): the 4B's own page said "Too big for this
  phone" / "Needs 4.1 GB of RAM; this phone can spare 3.9 GB.", while the
  Models page's Suggested card for Qwen3.5 4B said "Fits this phone" /
  "Needs 3.6 GB of RAM; this phone can spare 3.9 GB." / "On this phone."
- 08:32:19: the 0.8B's server saved the chat it held and exited ("cleaning
  up before exit"). 08:32:39: Android froze the app's process (`am_freeze`),
  so its foreground service was gone by then. 09:00:02: the system killed it
  ("am_kill … com.phonecando.app.full.dev,900,SmartBackground"); 09:00:12 it
  started again ("am_proc_start … aitune"); 09:06:26 its main screen opened.
  Logcat from before 08:30 is gone, so why the server and agents stopped at
  08:32 is not in the logs left.
- 09:12: the app showed the red `loadJSBundleFromAssets` box (the disconnect
  cleared `adb reverse`). After `adb reverse tcp:8081 tcp:8081` and Reload at
  09:17:00 the app stayed on a black screen: every dump to 09:26 showed only
  the splash icon view, logcat had no React Native line after 09:17:04, and
  Metro sat idle. A menu key (keyevent 82) at about 09:24:49 gave "PhoneCanDo Full
  Dev isn't responding" ("ANR … Input dispatching timed out (Application
  does not have a focused window)", 09:24:54); Wait took it back to the black
  screen.
- 08:01:56 (first tester): a mis-tap opened New agent > Choose agent; it
  backed out and nothing was created.

## Left on the phone

- A-04 (Claude Code): its chat was cleared with /clear at 08:03:42 and holds
  turns A and C and Claude Code's own compaction. A-10 (Codex): a new chat
  (/new at 08:09:04) with turn B. Only the plan's three prompts were sent;
  no other chats touched. The notes don't say any other agent was stopped
  first; the model's log shows only the turns' requests and Claude Code's
  compaction.
- All agents and the 0.8B's server are stopped (since 08:32; the app's
  process was killed and restarted by the system at 09:00). Neither tester
  restarted them.
- Three saved chats, 830 MB in all, in the 0.8B's `.chats/` folder.
- `adb reverse tcp:8081 tcp:8081` set again; Reload tapped on the red box,
  a menu key sent, and Wait tapped on the not-responding dialog. The app is
  left on a black screen, its process (started 09:00:12) still up: it needs
  closing and opening again before the next round.
- Screen stay-on set back to false. No settings changed.

## Screenshots

29 in all, each with a small copy. The first tester took 27, of the
drawer, the Models page, both model pages and Memory pages, and A-04's and
A-10's terminal Home, where dumps fail. The second tester took 2 (09:19,
09:24) of the app after Reload, where every dump returned only the splash:
both showed a black screen with the status bar.

## Review note (2026-11-16, by the session that planned the round)

Added after the round; the results above are unchanged.

- [MODEL-13](../../../../cases/local-models.md#model-13): the chat came
  back from storage 1.3 s after the send and turn C read 1,377 tokens,
  against 14,398 before this build. Its "Fail" comes from the case's old
  "a few dozen tokens", which was too strict: Claude Code adds its own text
  to every request. The case now expects only what was added since turn A.
- [MODEL-02](../../../../cases/local-models.md#model-02): the 17 minutes
  came from Claude Code compacting its conversation, not from the model
  server; that is on the todo.
- The black screen after the reload was Metro, the dev JS server: once the
  app was restarted it worked. Not an app issue.
