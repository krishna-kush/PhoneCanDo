# Open work (app)

Engine-specific work lives in each engine's own `docs/planning/todo.md`.

## 1. Turn R8 on for release builds

Expo SDK 58 turns R8 (shrink, optimise, rename) on for release builds by
default; we keep it off (`app/plugins/withBuildPerf.js`,
`android.enableMinifyInReleaseBuilds=false`) until it is safe. On, it makes
the APK smaller and faster, but:

- [ ] Rework the APK audit: `scripts/apk-audit.mjs` finds PCE in the full
  channel's dex by class name (`Lcom/phonecando/pce/`) and proves lite and
  play have none. R8 renames those classes; read them through
  `mapping.txt`, or keep the names the audit checks.
- [ ] Keep rules for everything found by name at run time:
  `FullAutomation.INSTANCE` (already in the runner's
  `consumer-rules-full.pro`), kotlinx-serialization in pce, lre and agents,
  nanohttpd, org.json. AGP 9's strict full mode keeps only what a rule names.
- [ ] Build a minified full release and test it on the phone: an agent's
  engine and web UI, the terminal, a Linux env setup, local models, phone
  control, the back gesture (its step must still run on the UI thread) and
  page motion.
- [ ] Then drop the property from `withBuildPerf.js`, and compare APK size
  and cold start before and after.

## 2. Play release: background work

The engine service is `specialUse` on every channel (no Android time
limit; `app/docs/modules/runner.md` → Foreground service and lifetime).
Before play ships:

- [ ] Declare `specialUse` in the Play Console (App content → Foreground
  service permissions): the feature, the user impact if it is deferred or
  interrupted (an agent's task is cut off mid-way and its work lost), and
  a video: give an agent a task, switch to another app, the notification
  lists the agent at work, come back to the finished task. The manifest's
  `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` holds the same reason. Termux ships
  on Play with `specialUse` for the same need.
- [ ] Only if Play refuses `specialUse`:
  - play's manifest gets `dataSync` instead (a per-channel override in
    `app/plugins/withBuildChannel.js`, and the type `goForeground()`
    passes), which Android 15+ stops after 6 hours of background awake
    time in any 24 (the app on screen moves the deadline to 6 h from then);
  - a warning notification 1 hour before that limit, on its own channel
    (the service's is `IMPORTANCE_LOW`): record `SystemClock.uptimeMillis()`
    when the app leaves the screen and post at that + 5 h
    (`Handler.postAtTime`, the same uptime clock Android counts); its tap
    must open the app, since only the app on screen moves the deadline;
  - model downloads as user-initiated data transfer jobs on Android 14+,
    which have no 6-hour budget and are what Play recommends for downloads:
    a `JobService`, `RUN_USER_INITIATED_JOBS`, `setUserInitiated(true)`
    with a network constraint and the size, scheduled on the Download tap,
    `setNotification` with progress; `onStopJob` cancels our job, keeps
    the `.part` and the resume-list entry and returns true so the system
    retries. Android 10-13 keep the service (no `dataSync` limit there).
- [ ] Play's Android vitals mark partial wake locks of 2 h or more a day
  (in over 5% of sessions) as excessive and may hide the app; UIDT jobs do
  not count. Check this before adding a wake lock for busy agents.
- [ ] On the phone, check whether a busy agent stalls while the screen is
  off (we hold no wake lock; the service keeps the process, not the CPU).

## 3. Packs: the key and the first signed packs

1.0 ships without a pack key, so release builds refuse every pack
(`docs/release/known-limits.md`). When the first packs are ready:

- [ ] Make the Ed25519 key (`pce/docs/modules/pack.md`, Key workflow): the
  private half offline with two backups, like the release key; the public
  half as `phonecando_pack_public_key` in the runner's
  `src/uiauto/res/values/pack_key.xml` (empty today; debug builds override
  it with the test key in `src/debug/`).
- [ ] Write and sign the first packs and their manifest, host them on a
  static HTTPS address (a GitHub release is enough), and test
  `mobile_pack refresh` and `run` on a release build.
- [ ] Ship the key in an app update, and drop the known-limits line.

## 4. Account: coming features (optional, need sign-in)

Sign-in (Settings → Account, `accounts/`, `docs/accounts.md`) is in place so
these can come later. Each one needs an account and stays optional: nothing
that works today may start needing one. The Account page lists them
(`app/src/ui/account/copy.ts`, `COMING`); keep that list and this one in step.

- [ ] Share chats with friends: send a chat with your agent to a friend, to
  read or carry on in theirs.
- [ ] Use a local agent together: invite friends into your agent's chat and
  work with it side by side, live, each from their own phone.
- [ ] Share compute: lend your phone's spare power and local models to a
  friend's agents, or borrow theirs for a big job.
- [ ] More fun together: other features for a crew of friends, each optional.
- [ ] Each of these ships with its lines in `docs/accounts.md` (what it keeps,
  for how long) and the site's privacy page before it reaches anyone.

## 5. ACP mode: what comes next (wait for the go)

ACP mode is built (`agents/AGENTS.md` → ACP mode, `app/docs/modules/runner.md`
→ ACP mode). These come next, built with parallel agents; none starts before
we say so.

- [x] Phone test of ACP mode (Update agent first on Claude Code and Pi): a
  task with the app closed, Home opened mid-run (background view, Stop, back
  to its own app on the same chat), a permission question (notification
  Allow/Deny and the in-app dialog), one agent waking another, a kind with no
  ACP mode still working as before, a custom agent with an ACP command, RAM
  during a background run. Then the checks: What it can do on an agent page,
  Check now on Claude Code and on a custom agent, a broken hook showing Not
  working (one notification, the level dropping, a waiting message saying
  why), a check that waits for you in the agent's own app (`Open <agent>`, its
  one notification, going on once you answer).
  Done by an AI tester on 2026-11-14 and 15; what each round found, and what
  is not tested yet, is in `phone-tests/` (`status.md`, and each round in `phones/`).
- [x] Checks on the phone for agents without ACP mode, and for what we add
  on top of ACP (hooks, the "open this chat" flag, phone tools from the
  agent's own config): each capability reads Checked, Not checked yet, Not
  working or Off, from exact signals (a bridge request with the agent's token,
  our inbox script reporting its hook ran, the run's output and exit). A
  failure shows the first time (the run, the message, one notification, the
  level shown); Check now runs one short test task.
- [x] A guessed stop let the CPU sleep mid-run: a TUI run that showed
  nothing for 30 s counted as stopped (TuiEvents.quiet, for Claude Code's
  Esc, which fires no hook), and that released the wake lock while the run
  could still work (seen 2026-11-14: Claude Code's helper agent reading its
  prompt on a local model). Now a quiet run counts as stopped 30 s after
  you typed into it (only you can type an Esc), else only after 30 min of
  nothing (a hook that never fired); `app/docs/modules/runner.md` → TUI
  engines. The checks skip such a guess (`EngineEvent.guessed`).
- [x] Bring back agents a reboot cut off. Built (`runner/cutoff/`,
  `app/docs/modules/runner.md` → Cut-off runs): a run cut off by a reboot,
  an update, Android closing PhoneCanDo or its engine dying gets one notice
  per agent, and Continue starts the agent again in the same chat with a
  note to go on. Runs older than a day, or whose agent showed no sign of
  work for an hour, are not offered. `docs/release/known-limits.md` says
  what it can't do. Phone-tested 2026-11-16: a reboot, then Continue
  (BACK-01, Pass). Android killing the app (BACK-02) failed on a falsely
  working opencode chat, fixed in W2-4 and not run again yet; BACK-03 to
  BACK-06 are not run yet (`phone-tests/status.md`).
- [x] A message may start a stopped agent. Our idle stop stops an idle
  agent a few minutes after you leave the app (unless Keep running), and a
  message never started a stopped one, so other agents could wake it only
  in those minutes. With "Other agents can wake it" on, it now starts in
  ACP mode with the message. An answer to a waking message wakes the agent
  that asked (MSG-10, MSG-11), and a waking message that didn't wake says
  why (MSG-12 failed on W2-3 on a falsely working opencode chat; fixed in
  W2-4, not run again yet).
- [x] Local models re-read the whole prompt too often: on 2026-11-15 each
  of Claude Code's requests read its 19k-token prompt again (12-15 min on
  Qwen3.5 0.8B) while its own sub-agent requests took turns with it.
  Qwen3.5 is a hybrid model, which llama.cpp caches less well. First fixed
  2026-11-15 in our launch plan, with no llama.cpp patch: checkpoints are
  capped and counted, and half-size notes come in when RAM is short. Then
  on 2026-11-16 chats that take turns went to storage: a go-between in the
  runner (`runner/models/chats/`) saves the slot's chat before another
  chat takes it and loads the right one back, up to 4 per model; the RAM
  prompt cache (every request saves the slot and loads the best saved
  prompt) now serves only a phone short of storage (`lme/docs/README.md` →
  RAM gate and context). Phone-tested 2026-11-16 (MODEL-13): the chat came
  back from storage 1.3 s after the send, and the turn read 1,377 tokens
  instead of 14,398 (its Fail is against the case's old "a few dozen
  tokens": the round's review note).
- [x] Codex's message hooks: a new Codex agent (0.169.0, its install links
  `/etc/codex/hooks.json`) checks "Messages during its turns" on
  2026-11-15; the test phone's older one only lacked the link (Update
  agent makes it). Never link through an `sh -c` launch: the kit puts
  model args right after the program, so a wrapper breaks Codex on any
  model we give it.
- [x] Small ones: keys typed on a page with no field focused still reach
  opencode's web page behind it (the WebView keeps Android's input
  focus); a Run now task says `(once at <its next time>)` instead of when
  it ran; after Update agent, Home shows "stopped · Restart" instead of
  starting it again; an agent that ran before a Check now is left stopped
  after it (start it again on its own model); New agent lists Codex as
  "Messages · inbox only" though its hooks deliver during turns; the
  engine notification can keep an old chat's title; Run now leaves a once
  schedule on; "Other agents can wake it" shows while the agent's level
  now can't wake (its ACP mode failed), and "Woken while idle" reads Off
  for kinds that wake only through ACP mode.
- [ ] goose: its first own-app start asks "Share anonymous usage data…",
  which stalls Check now (seed the answer in its config); and its install
  fails on an amazonlinux machine (`No match for argument: ripgrep`).
- [ ] Telemetry: count those failures for built-in kinds only (kind,
  capability, CLI version, kind of failure; no text, never a custom kind's
  id), with its line in `docs/telemetry.md`.
- [ ] Codex in ACP mode: the `codex-acp` adapter (it ships its own Codex,
  about 100 MB; see whether it can use the one we install), a trial run, then
  its `engine.acp` and README section.
- [ ] CI: a nightly run of each built-in kind's ACP mode against a scripted
  fake model in a container (the trial kit we used on the PC), so a vendor
  update that breaks a kind shows up before users see it.
- [ ] Found by the 2026-11-15 and 16 phone tests (`phone-tests/status.md`):
  - [ ] Claude Code on a local model compacted its chat at about 16k of a
    32k context, and the compaction request read the whole prompt again.
    On 2026-11-16 it compacted at once in a turn whose chat came back from
    storage in 1.3 s (3,817 tokens written in 9.3 min, then a new
    16,787-token prompt read in 6.5 min: 17 min in all), so it is now the
    biggest slowdown left. Find out why it compacts so early (what context
    size it believes it has), without turning its compaction off.
  - [x] With one saved chat (8 GB phones), a third chat pushed the saved
    one out. Chats that take turns now go to storage, up to 4 per model
    (`runner/models/chats/`, see above); a phone short of storage still
    keeps them in RAM, with that limit.
  - [ ] Check records are kept per kind, so one agent's failed check lowers a
    newer agent's level; keep them per agent.
  - [x] lme didn't count llama.cpp's working memory (compute buffers, about
    0.1-0.5 GB) in a plan's total. Now each model server's memory is
    measured by llama.cpp's own dry run before it starts (compute buffer
    and repacked weights included; `runner/models/measure/`, lme's
    `FitBreakdown`), kept per model and phone. Phone-tested 2026-11-16
    (MODEL-15).
  - [x] An opencode chat that got a message without a run stayed on
    "Working". Fixed in W2-4: opencode's inbox events no longer count as
    working, and a server kind's working chats are checked against the
    chats its server says run (`chats.active`). Not run again on the phone
    yet (MSG-12, BACK-02).
  - [x] An em dash in an `agents_send` text was stored as three replacement
    characters. Fixed in W2-4: bridge request bodies are read as UTF-8.
  - [ ] A woken opencode turn can land in an old session, which then shows
    a duration like "4,651m 37s" (MSG-10).
  - [ ] A Run now task in opencode shows no bubble of its own; the reply sits
    under the earlier turn.
  - [ ] After the drawer closes, keys typed on Home reach opencode's box only
    after a tap; the header tap sometimes misses the drawer while the
    keyboard is up.
  - [ ] Esc in Claude Code's own app during a check is only a guessed stop,
    which the checks skip, so the check's 30-minute limit ends it.
- [ ] llama.cpp: what to change when it gives better tools (the `--fit`
  bug with repacked weights, a memory endpoint, a disk cache that would
  replace our chat-saving go-between, `--no-repack`, the v1.0.0 bump) is
  listed in `lme/docs/planning/todo.md` → Waiting on llama.cpp.
- [ ] A model list that can't be read: rebuild it from the model files
  already on the phone (re-read each header, re-hash) instead of breaking
  the Models page, so a format change never costs a download again.
- [ ] `./manage build`: stage a llama-server built from the current pin
  (staged, else CI's `llamacpp-android-arm64`, else built here), warn how
  far the pin is behind llama.cpp's newest release, and ask whether to
  switch (default no), as the agent payloads do.
