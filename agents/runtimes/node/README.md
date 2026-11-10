# node runtime

Node.js 22 or newer for image kinds that name `node` (or `node>=22`) in
`requires.runtimes`. `runtime.json` is the plugin.

| Family | Script | What it does |
|---|---|---|
| apk | `install/apk.sh` | `apk add nodejs npm`, then checks the major is at least 22 (Alpine 3.21 and later). nodejs.org builds no musl binaries. |
| every other | `install/glibc.sh` | The pinned official `linux-arm64` `.tar.xz` from nodejs.org, checked against its sha256, unpacked into `$HOME/.local/opt/node` (`paths`). Needs glibc 2.28 or newer. |

`glibc.sh` unpacks and runs the new tree beside the old one before it
swaps it in, so `$HOME/.local/opt/node` never holds a half-unpacked tree.
Under HOME, the install survives a machine reset.

## What an image needs

`glibc.sh` needs `curl` or `wget`, `tar`, `xz`, `sha256sum` and a CA
bundle. Many registry images lack some (`debian` and `ubuntu` ship no
`curl` or CA bundle), so the script installs the missing ones, except
`sha256sum`, with the image's own package manager (`apt-get`, `dnf`,
`microdnf`, `yum`, `pacman`, `zypper` or `xbps-install`). An image with
no package manager must already have them.

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

Also bump the `node` image tag and digest in
`.github/ci/local-models/Dockerfile`: the local-model check's x86_64
machine starts from it. The `lre-compat.yml` agent leg installs the new
pin on every Tier 2 image.

## Licence

Node.js is MIT. We don't redistribute it: the phone downloads it from
nodejs.org (or Alpine's mirrors) at the user's request.
