# node runtime

Node.js 22 or newer for image kinds that name `node` (or `node>=22`) in
`requires.runtimes`. It is installed only into the machine whose agent asks
for it, before the kind's packages and steps (kit-render `InstallRenderer`).
`runtime.json` is the plugin; the app packages this folder for the channels
that ship Linux (full and lite).

| Family | Script | What it does |
|---|---|---|
| apk | `install/apk.sh` | `apk add nodejs npm`, then checks the major is at least 22 (Alpine 3.21 and later). nodejs.org builds no musl binaries. |
| every other | `install/glibc.sh` | The pinned official `linux-arm64` `.tar.xz` from nodejs.org, checked against its sha256, unpacked into `$HOME/.local/opt/node` (`paths`). It needs glibc 2.28 or newer. |

Both are idempotent POSIX sh. `glibc.sh` unpacks and runs the new tree
beside the old one before it swaps it in, so `$HOME/.local/opt/node` never
holds a half-unpacked tree. Under HOME, the install survives a machine reset.

## What an image needs

`glibc.sh` needs `curl` or `wget`, `tar`, `xz`, `sha256sum` and a CA
bundle. The Default image has them all. Many registry images lack some
(`debian` and `ubuntu` ship no `curl` or CA bundle, for example), so the
script installs the missing ones
with the image's own package manager (`apt-get`, `dnf`, `microdnf`, `yum`,
`pacman`, `zypper` or `xbps-install`) before it downloads. An image with no
package manager must already have them. `sha256sum` (coreutils or busybox)
is never installed for you.

`apk.sh` needs only `apk` and a reachable Alpine mirror.

## Bumping the pin

`NODE_VERSION` and `NODE_SHA256` in `install/glibc.sh` change together, to
the newest 22.x release:

```sh
d=$(mktemp -d) && cd "$d"
curl -fsSLO https://nodejs.org/dist/v<version>/SHASUMS256.txt.asc
gpg --verify SHASUMS256.txt.asc          # a key from github.com/nodejs/release-keys
grep 'linux-arm64.tar.xz$' SHASUMS256.txt.asc
```

The `lre-compat.yml` agent leg installs it on every Tier 2 image.

Pinned now: v22.23.4 (2026-10-20), signed by release key
`5BE8A3F6C8A5C01D106C0AD820B1A390B168D356`.

## Licence

Node.js is MIT (`licence` in `runtime.json`). We don't redistribute it: the
phone downloads it from nodejs.org (or Alpine's mirrors) at the user's
request.
