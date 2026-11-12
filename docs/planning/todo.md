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
