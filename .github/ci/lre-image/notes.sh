#!/usr/bin/env bash
# Release notes for one published Default env image, from its final
# manifest. The hidden run-id line is what `./manage image lock <run-id>`
# finds the release by; keep its format.
#
# Usage: notes.sh <manifest.json>   (markdown on stdout)
set -euo pipefail

M="${1:?usage: notes.sh <manifest.json>}"
j() { jq -r "$1" "$M"; }

cat <<EOF
The baked **Default env** for PhoneCanDo: a Debian-based arm64 root
filesystem (Debian $(j .debian.version), docker.io/library/debian:$(j .debian.tag) \`$(j .debian.digest)\`,
packages from snapshot.debian.org \`$(j .debian.snapshot)\`). Each app version ships
the image its \`lre/images/default/lock.json\` names; this release never changes.
Not an app release: never marked latest.

| | |
|---|---|
| Image | \`$(j .asset)\` |
| sha256 | \`$(j .sha256)\` |
| Size | $(j .size) bytes xz, $(j .tar_size) bytes tar, $(j .packages) packages |
| Built and tested | run [$(j .run.id)]($(j .run.url)) at \`$(j .run.commit)\` |

**Corresponding source.** The \`-sources-NN.tar\` assets hold the exact Debian
source packages (\`.dsc\`, upstream and Debian tarballs) of every package in this
image, and of what was built into them statically (Built-Using), at the
installed versions: \`dpkg-source -x <source>/<source>_<version>.dsc\` unpacks
one. \`-sources-index.tsv\` lists every file with its sha256;
\`-packages.tsv\` maps each installed package to its source. Our build recipe
(\`lre/images/default/\`) is in the repository at the commit above; rebuilding
it with the inputs in the manifest gives the same bytes.

<!-- phonecando-run-id: $(j .run.id) -->
EOF
