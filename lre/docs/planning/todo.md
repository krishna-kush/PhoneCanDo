# Open work

Legend: `[ ]` todo, `[~]` in progress. Known limits that are not scheduled
work are in `../release/known-limits.md`.

## 1. Lock the first Default image

- [ ] Publish a green `lre-image.yml` run on prod, then
  `./manage image lock <run-id>` and commit
  `lre/images/default/lock.json`.

What is missing: every field of `lock.json` is null, so no build ships the
Default image. Debug builds carry one only when it is staged locally
(`./manage image stage --local`), and `./manage release` refuses full and
lite without it unless told `--without-linux`.

Order: publish, lock, then `./manage image fetch && ./manage image stage`
for the next release (`../guides/images.md`).

## 2. Align the baked hostname with setup's

- [ ] Make `lre/images/default/recipe/files/etc/hostname` and `hosts` say
  what setup writes.

What is missing: the baked image's `/etc/hostname` is `localhost` and its
`/etc/hosts` names only `localhost` (`lre/images/default/recipe/files/etc/`),
while setup's fixups write `phonecando` into both
(`lre/image/src/main/kotlin/com/phonecando/lre/image/fixup/NetFiles.kt`).
Setup overwrites the baked files, so a running image already says
`phonecando`; the image itself still disagrees.

What must change: the two recipe files. Any recipe change names a new
image version (`lre/images/default/inputs.sh`), so this lands with the next
published image and its lock.

## 3. Drop the proot ashmem patch once upstream has it

- [ ] Offer `lre/proot/patches/0001-ashmem_memfd-include-string.h.patch`
  to termux/proot; drop it after a pin bump that contains the include.

The patch adds `<string.h>` to `src/extension/ashmem_memfd/ashmem_memfd.c`,
which a stock NDK r28c clang rejects without it. Its header says it is
upstreamable as is.

## 4. Check the dependency law in CI

- [ ] Add a check like pce's `.github/ci/pce/check-deps.mjs` that fails
  when a module's `build.gradle.kts` adds an edge the law in `../../AGENTS.md`
  forbids (for example `image` → `oci`), and run it in `lre.yml`.

What is missing: today only each `build.gradle.kts` holds the law; nothing
fails when one adds a forbidden project dependency.

## 5. Test the Default image with the real launch.conf writer

- [ ] Let Tier 1 (`lre-image.yml`) write `run/launch.conf` with `image`'s
  `LaunchConf` (through `cli`) instead of the hand-written
  `.github/ci/lre-image/launch-conf.sh`, and run it on `lre/image/**`
  changes.

What is missing: the two writers are kept in step by hand, so a change to
`LaunchConf.kt` is tested against registry images (Tier 2) but never
against the Default image.
