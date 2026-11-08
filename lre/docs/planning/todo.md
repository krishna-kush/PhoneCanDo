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

## 5. Get proot-me/proot#60 solved upstream, or learn why it is not

- [ ] Job control under proot has been broken upstream since 2014
  (proot-me/proot#60, open, help-wanted; termux/proot has no issue or PR),
  and 0003 is our fix. Either get it fixed upstream, so we can drop 0003:
  offer it to termux/proot as a PR and link it on #60; or find out for
  real why nobody fixed it: ask on #60 and termux/proot, read both trees'
  history for an attempt, and check what `PTRACE_SEIZE` breaks for them
  (old Android kernels termux still supports, their ptrace emulation, the
  `--kill-on-exit` and detach paths). Write down what we learn in
  `../modules/proot.md` → Job control.
- [ ] Once the fix is in termux/proot: bump `lre/proot/pins.env` to a
  commit that has it, delete `0003-ptrace-seize-job-control.patch` and its
  lines in `../modules/proot.md`, `../planning/decisions.md` and
  `THIRD_PARTY_NOTICES.md`, and keep the stop checks in `proot-test.sh`:
  they must pass on upstream's fix as they do on ours.
