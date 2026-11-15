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

- [ ] Phone test of ACP mode (Update agent first on Claude Code and Pi): a
  task with the app closed, Home opened mid-run (background view, Stop, back
  to its own app on the same chat), a permission question (notification
  Allow/Deny and the in-app dialog), one agent waking another, a kind with no
  ACP mode still working as before, a custom agent with an ACP command, RAM
  during a background run. Then the checks: What it can do on an agent page,
  Check now on Claude Code and on a custom agent, a broken hook showing Not
  working (one notification, the level dropping, a waiting message saying
  why), a check that waits for you in the agent's own app (Open <agent>, its
  one notification, going on once you answer).
- [x] Checks on the phone for agents without ACP mode, and for what we add
  on top of ACP (hooks, the "open this chat" flag, phone tools from the
  agent's own config): each capability reads Checked, Not checked yet, Not
  working or Off, from exact signals (a bridge request with the agent's token,
  our inbox script reporting its hook ran, the run's output and exit). A
  failure shows the first time (the run, the message, one notification, the
  level shown); Check now runs one short test task.
- [ ] A guessed stop lets the CPU sleep mid-run: a TUI run that shows
  nothing for 30 s counts as stopped (TuiEvents.quiet, for Claude Code's
  Esc, which fires no hook), and that releases the wake lock while the run
  may still work (seen 2026-11-14: Claude Code's helper agent reading its
  prompt on a local model). The checks already skip such a guess
  (`EngineEvent.guessed`); the wake lock and the chat board still take it.
- [ ] Bring back agents a reboot cut off. After the first unlock
  (`ScheduleBootReceiver` already re-arms schedules then), restart each
  agent that had a run going when the phone went down and tell it to go on
  with its interrupted task, in the same chat (it is on disk). Only agents
  that were mid-task, and only with your OK: a notification with Continue,
  or a setting. It needs a record on disk of which runs were going.
  Today they stay stopped, and a cut-off scheduled run reads failed ("PhoneCanDo
  was closed before the task finished"). When it ships, update
  `docs/release/known-limits.md` (its boot receiver and dead-engine lines).
- [ ] A message may start a stopped agent. Our idle stop stops an idle
  agent a few minutes after you leave the app (unless Keep running), and a
  message never starts a stopped one, so other agents can wake it only in
  those minutes. With "Other agents can wake it" on, start it in ACP mode
  with the message instead.
- [ ] Local models re-read the whole prompt too often: on 2026-11-15 each
  of Claude Code's requests read its 19k-token prompt again (12-15 min on
  Qwen3.5 0.8B) while its own sub-agent requests took turns with it.
  Qwen3.5 is a hybrid model, which llama.cpp caches less well; look at its
  context checkpoints and our `--cache-ram`.
- [x] Codex's message hooks: a new Codex agent (0.169.0, its install links
  `/etc/codex/hooks.json`) checks "Messages during its turns" on
  2026-11-15; the test phone's older one only lacked the link (Update
  agent makes it). Never link through an `sh -c` launch: the kit puts
  model args right after the program, so a wrapper breaks Codex on any
  model we give it.
- [ ] Small ones: keys typed on a page with no field focused still reach
  opencode's web page behind it (the WebView keeps Android's input
  focus); a Run now task says "(once at <its next time>)" instead of when
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
