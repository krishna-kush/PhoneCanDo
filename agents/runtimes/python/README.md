# python runtime

Python 3.12 through Astral's `uv`, for image kinds that name `python` in
`requires.runtimes`. `runtime.json` is the plugin.

| Family | Script | What it does |
|---|---|---|
| every family | `install/uv.sh` | The pinned official `uv-aarch64-unknown-linux-musl` build from uv's GitHub release, checked against its sha256 and unpacked into `$HOME/.local/opt/python/bin` (`paths`: `uv`, `uvx`). Then `uv python install 3.12`. |

A kind then installs its package with
`uv tool install --python 3.12 <package>@latest`: uv makes the tool's own
venv under `$HOME/.local/share/uv/tools/` and links its commands into
`$HOME/.local/bin`. The runtime and every tool live under HOME, so they
survive a machine reset.

The check, `uv python find 3.12` with `paths` first on PATH, passes when a
uv runs and finds Python 3.12 (uv's own or the image's), so an image that
already has both skips the script.

## Why uv

- One file for every family: uv's musl build is statically linked, so it
  runs on glibc and musl images alike.
- The Python a kind needs, whatever the image ships: Debian 13 has 3.13
  and Alpine 3.22 has 3.12, but Aider needs below 3.13 and Mistral Vibe at
  least 3.12. uv installs CPython 3.12 from python-build-standalone,
  checked against the sha256 each uv release carries, so the uv pin pins
  Python too.
- Each tool in its own venv: only `uv` and `uvx` go on PATH, so the
  agent's `python3` stays the image's.
- It is what the vendors of our Python kinds tell you to use.

The image's own python3 with `venv` and pip was the alternative. It gives
whatever version the image has (often not one a kind takes), Debian splits
`venv` into its own package, and Alpine often needs a compiler for wheels
that pip would build.

## What an image needs

`uv.sh` needs `curl` or `wget`, `tar`, `gzip`, `sha256sum` and a CA bundle
for the uv download, and installs the missing ones (except `sha256sum`)
with the image's own package manager. uv carries its own TLS roots for
what it downloads.

## Under proot

Kinds run uv with `UV_LINK_MODE=copy`, then `uv cache clean`. uv
hard-links files from its cache by default; our proot emulates hard links
(`--link2symlink`), and a copy keeps each tool's venv plain files. The
clean keeps the cache off the phone's storage.

## Bumping the pin

`UV_VERSION` and `UV_SHA256` in `install/uv.sh` change together, to the
newest uv release:

```sh
v=<version>
curl -fsSL https://github.com/astral-sh/uv/releases/download/$v/uv-aarch64-unknown-linux-musl.tar.gz.sha256
```

The same sha256 shows as the asset's digest on the release page. Also
bump the `astral/uv` image tag and digest in
`.github/ci/local-models/Dockerfile`, which the local-model check copies
uv from.

## Licence

uv is MIT or Apache-2.0; CPython is under the PSF License. We don't
redistribute either: the phone downloads them from GitHub at the user's
request.
