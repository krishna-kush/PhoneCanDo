# Settled decisions

- **Own pure-JVM build** (`lre/`, beside `pce/` and `tce/`), included by
  the app as a composite build: the same code runs on the phone and in CI
  on a plain JVM (`cli`), so distro images are tested with the phone's
  exact setup code.
- **`image` never imports `oci`:** a host composes a download with a
  setup; the baked Default image and a registry image are then one kind of
  `BaseImage`.
- **Shims are symlinks to one multi-call launcher that execs proot in
  place:** no fork per command, one file (`launch.conf`) says how every
  command of an image runs, and `SHELL` can point at the launcher itself
  (its own name means bash).
- **The engine stays a bionic binary outside proot:** the runner starts it
  with `run/engine.env` and never depends on `lre/`; only its shell and
  commands go through the shims (device-verified 2026-11-06).
- **Everything that executes ships as `lib*.so`** in the native-library
  dir: it is the only app path Android lets us exec from, and AGP packages
  only `lib*.so` names. Everything else an image holds is data.
- **proot loader unbundled:** a bundled loader is written to and exec'd
  from `PROOT_TMP_DIR`, which Android's W^X forbids for app data.
- **talloc static, built from `talloc.c` with our `config.h`:** a
  `libtalloc.so.2` SONAME cannot ship as a jniLib, and waf would need
  python and cross-answers to build parts proot never uses.
- **No 32-bit loader:** we ship arm64 guests only, and a `-m32` build is
  impossible on arm64 hosts.
- **MIT build scripts for proot:** our scripts, pins, patches and talloc
  config are ours to license and go into the GPL source tarball; proot and
  talloc keep their licences and are downloaded, never stored.
- **Both data-dir spellings bound and listed as `same`:** inside the app
  process `getcwd()` says `/data/data/<pkg>` while Context says
  `/data/user/0/<pkg>`; a command must keep its project folder under
  either (device-verified).
- **`home/` and `tmp/` at `/root` and `/tmp` and at their own host paths:**
  the engine's file tools see host paths and its commands must see the
  same ones.
- **Background processes keep running** (no `--kill-on-exit`), as on a PC;
  they are reaped by tag: `PHONECANDO_AGENT` when the engine stops,
  `PHONECANDO_IMAGE` before a reset or delete.
- **Always fake root:** package managers work; an image config's user and
  working dir are recorded, not applied.
- **Detect, don't tabulate:** OS, family and shell come from the image
  itself; the only table is package families, and an unknown family still
  works without an install hint.
- **Setup steps recorded and idempotent:** a killed setup resumes at the
  step that failed; an interrupted unpack restarts from an empty rootfs.
- **Reset swaps by rename with a marker file:** a kill at any point leaves
  a working image; `home/` survives and hand-installed packages are
  offered, not reinstalled.
- **Delete by atomic rename into a trash dir:** the image is gone for every
  reader at once and its id is free; the slow delete runs in the
  background.
- **`launch.conf` and the shims rewritten before every start:** the APK's
  lib dir moves on every update, and the phone's DNS changes between
  starts.
- **Hard links become copies** when unpacking (apps may not create hard
  links); inside the guest, proot's `--link2symlink` emulates them.
- **xz for the baked image:** one `xz -9` stream decoded by XZ for Java
  (0BSD) in `tar`, stored uncompressed in the APK so it streams straight
  from `AssetManager`.
- **Reproducible Default image:** a pinned Debian digest and a pinned
  snapshot.debian.org timestamp, a deterministic tar, a version named by
  its inputs; CI proves a second build gives the same bytes.
- **Published as a prerelease, never latest:** the app updater reads
  `releases/latest`; the APK ships only what `lock.json` names, adopted by
  hand from a green run.
- **Docker Hub mirrors for official images** (`public.ecr.aws`,
  `mirror.gcr.io`): Docker Hub's anonymous limit (about ten pulls an hour
  per IP) is normal to hit; digests make every copy as good as the
  original.
- **We follow redirects ourselves:** the rule that credentials never leave
  the registry's host lives in our code, the same for every transport.
- **Short image ids** (six characters, down to three): every socket under
  `home/` and `tmp/` carries the id within `sun_path`'s 108 bytes.
