# Default image

The Default env: a Debian-based arm64 rootfs baked into the full and lite
APKs as one xz layer, so a first agent works offline. Built once per
version, reproducibly, and never changed. How to build, publish, lock and
stage it: `../guides/images.md`.

Files: `lre/images/default/`.

| File | Role |
|---|---|
| `pins.env` | `DEBIAN_TAG` (`trixie`), `DEBIAN_DIGEST` (the linux/arm64 manifest of Docker's official `debian:trixie`) and `SNAPSHOT` (the snapshot.debian.org timestamp apt installs from). |
| `recipe/packages.txt` | The Standard set, installed with `--no-install-recommends`. |
| `recipe/bake.sh` | Runs inside a container of the pinned image: installs, strips, writes the marker. |
| `recipe/pack.sh` | Runs inside a container of the baked image: the deterministic tar, xz, sha256 and the package and source lists. |
| `recipe/files/etc/` | Files we bake: apt sandbox, dpkg slim rules, locale, hosts, hostname, resolv.conf. |
| `inputs.sh` | The inputs of one build and the version they name; `--fresh` for the newest digest and today's snapshot. |
| `build.sh` | bake → `docker export` → pack → manifest. |
| `verify.py` | Checks a build against its manifest and our rules. |
| `gpl/` | `resolve.py`, `fetch.py`, `pack.py`: the exact Debian source packages behind an image. |
| `lock.json`, `lock/` | The image the APK ships, and `check.sh`, `lock.sh`, `fetch.sh`, `stage.sh`. |

## What is in it

- Debian 13 from the pinned `debian:trixie` digest, upgraded and installed
  from the pinned snapshot (`trixie`, `trixie-updates`,
  `trixie-security`). The image keeps Debian's own sources
  (`deb.debian.org`), so `apt-get update` in it gets current packages.
- The Standard set (`recipe/packages.txt`): bash, ca-certificates, curl,
  git, less, nano, openssh-client, procps, python3, python3-pip,
  python3-venv, ripgrep, unzip, xz-utils, zip.
- Our baked files: `APT::Sandbox::User "root"` (apt runs as proot's fake
  root, with no real `_apt` user), dpkg path excludes for docs, man and
  info pages and translations (each package's `copyright` stays),
  `LANG=C.UTF-8`, and a public-fallback `resolv.conf` that setup replaces
  with the phone's DNS.
- `/etc/phonecando-image`: `NAME`, `VERSION`, `DEBIAN_TAG`,
  `DEBIAN_DIGEST`, `DEBIAN_SNAPSHOT`, `RECIPE_SHA256`.
- Left out: package lists, caches, logs, `/tmp`, and the contents of
  `/dev`, `/proc` and `/sys` (empty dirs for proot to bind over).

## Version and determinism

`VERSION = <snapshot date>-<8 hex>`, the hex from the sha256 of the recipe
hash (names and contents of every file under `recipe/`), the Debian digest
and the snapshot (`inputs.sh`). The same inputs always name the same
version; any change names a new one. The release tag is
`linux-image-<VERSION>`.

The tar has names sorted, every mtime `SOURCE_DATE_EPOCH` (the snapshot's
date), uid/gid 0 with no names, POSIX format without atime, ctime, xattr,
ACL or SELinux records, and no device nodes. xz runs at preset 9 (64 MiB
dictionary, the decoder needs about 65 MiB) with the multi-threaded encoder
always, so the bytes do not depend on `XZ_THREADS`. Python bytecode is
hash-checked, so it stays valid whatever mtime the app's unpacker gives the
`.py` files.

## Build output

`build.sh <out-dir>` writes:

- `phonecando-linux-default-<VERSION>-arm64.tar.xz` and its `.sha256`
- `phonecando-linux-default-<VERSION>.json` — the manifest (`schema: 1`):
  name, version, arch, asset, sha256, size, tar size, entries, package
  count, Debian tag, digest, snapshot and version, `source_date_epoch`,
  `recipe_sha256`, tool versions, xz preset and decoder memory. Publishing
  adds the release, run and source assets.
- `packages.tsv` (each installed package and its source), `sources.tsv`
  (every source package, including what was built in statically) and
  `inputs.env`.

`verify.py` checks the sha256 and sizes against the manifest; the tar's
determinism rules; empty `/dev`, `/proc`, `/sys`; no docker leftovers, apt
lists, caches or logs; no man or info pages or translations; only
copyright files under `/usr/share/doc`, one for every installed package;
our baked files and a marker matching the manifest; and the Standard set's
commands.

## How the app uses it

`./manage image stage` puts `rootfs.tar.xz` and `image.json` under the
module's `assets/default-image/` (full and lite; stored, not deflated, via
`app/plugins/withStoredAssets.js`). `DefaultImageAsset` streams it as one
`Compression.XZ` layer with no config; the env record carries its version
from `image.json`. From there it is a base like any other:
`ImageSetup.create` unpacks it, detects Debian and the apt family, and
writes the phone's DNS, hosts and hostname over the baked ones.

## Lock

`lock.json` names the one image the APK ships: `version`, `release`,
`asset`, `url`, `repo`, `sha256`, `size`, `debian_digest`, `snapshot`,
`run_id`. Either every field is null (nothing locked yet; today's state) or
every field is set and consistent (`lock/check.sh`). `--remote` also asks
GitHub, read-only, that the release exists as a published prerelease, is
not the latest release, holds the asset at that size, and that its manifest
names the same sha256, version, run and Debian digest.

## Tests

`lre-image.yml`: build on arm64, `verify.py`, a second build that must give
the same sha256, Tier 1 (the image through our launcher and a glibc proot,
commands run as opencode runs them), the GPL source bundle packed twice
with the same bytes, and `lock/check.sh --remote`. See
`../guides/testing.md`.
