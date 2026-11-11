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
