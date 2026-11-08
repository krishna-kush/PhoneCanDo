# Open work

Known limits that are not scheduled work are in `../release/known-limits.md`.

## 1. Lock the first Default image

- [ ] After a green `lre-image.yml` run on prod: `./manage image lock
  <run-id>`, commit `lre/images/default/lock.json`, then `./manage image
  fetch && ./manage image stage` for the next release
  (`../guides/images.md`). Until then no release ships the Default image.

## 2. Drop the proot ashmem patch once upstream has it

- [ ] Offer `lre/proot/patches/0001-ashmem_memfd-include-string.h.patch`
  (a missing `<string.h>`) to termux/proot; drop it after a pin bump that
  has the include.

## 3. Check the dependency law in CI

- [ ] A check in `lre.yml`, like pce's `.github/ci/pce/check-deps.mjs`,
  that fails when a `build.gradle.kts` adds an edge `../../AGENTS.md`
  forbids (for example `image` → `oci`).

## 4. Test the Default image with the real launch.conf writer

- [ ] Let Tier 1 write `run/launch.conf` with `LaunchConf` (through `cli`)
  instead of the hand-written `.github/ci/lre-image/launch-conf.sh`, so a
  `LaunchConf.kt` change is tested against the Default image too.

## 5. Hold jobs stopped by Ctrl-Z

- [ ] Under proot a job Ctrl-Z stops keeps running while the shell shows
  it Stopped (`../release/known-limits.md`). Fix: proot attaches with
  `PTRACE_SEIZE` and parks a group-stopped tracee with `PTRACE_LISTEN`
  until SIGCONT; its own patch in `lre/proot/patches/`, proven on the
  phone.
