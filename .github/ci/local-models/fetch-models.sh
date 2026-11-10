#!/usr/bin/env bash
# The local-model check's test models (models.json): each file from its
# Hugging Face repository at the pinned revision, kept only when its size
# and sha256 match. A file already in <dir> that matches is reused (CI
# restores <dir> from its cache first).
#
# Usage: fetch-models.sh <models.json> <dir>
#   Markdown on stdout; exit 1 when a file cannot be fetched or does not match.
set -euo pipefail
export LC_ALL=C

LIST="${1:?usage: fetch-models.sh <models.json> <dir>}"
DIR="${2:?usage: fetch-models.sh <models.json> <dir>}"
mkdir -p "$DIR"

echo "| Model | Template | File | Size | |"
echo "|---|---|---|---|---|"
fail=0
while IFS=$'\t' read -r id template repo revision file size sha; do
  dest="$DIR/$file"
  state=cached
  if ! { [ -f "$dest" ] && [ "$(stat -c %s "$dest")" = "$size" ] && [ "$(sha256sum "$dest" | cut -d' ' -f1)" = "$sha" ]; }; then
    state=fetched
    rm -f "$dest" "$dest.part"
    if ! curl -fsSL --retry 3 --retry-delay 10 --connect-timeout 20 -o "$dest.part" \
      "https://huggingface.co/$repo/resolve/$revision/$file"; then
      state="**FAIL**: download"
    elif [ "$(stat -c %s "$dest.part")" != "$size" ] || [ "$(sha256sum "$dest.part" | cut -d' ' -f1)" != "$sha" ]; then
      state="**FAIL**: size or sha256 differs"
    else
      mv "$dest.part" "$dest"
    fi
    rm -f "$dest.part"
  fi
  case "$state" in *FAIL*) fail=1 ;; esac
  echo "| \`$id\` | $template | [\`$repo\`](https://huggingface.co/$repo/tree/$revision) \`$file\` | $((size / 1048576)) MiB | $state |"
done < <(jq -r '.[] | [.id, .template, .repo, .revision, .file, .size, .sha256] | @tsv' "$LIST")
exit "$fail"
