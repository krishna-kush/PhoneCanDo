#!/usr/bin/env bash
# Publish one tested Default env image as the GitHub release
# linux-image-<version>: the image, its .sha256, the final manifest (build
# manifest + release, run and source assets), packages.tsv and the GPL
# source bundle. Never marked latest (our updater reads releases/latest).
#
#   1. same tag already published: same sha256 -> done; else fail
#      (a stale draft from a failed attempt is deleted)
#   2. fresh inputs only: same base digest, recipe and package versions as
#      the newest published image -> nothing new, done (only the snapshot
#      date in the version would differ)
#   3. upload everything to a draft prerelease, check every asset arrived
#      at its size, then publish it (prerelease, --latest=false) and check
#      that releases/latest did not move
#
# Usage: publish.sh <image-dir> <sources-dir>
#   <image-dir>    the lre-image artifact (build.sh's out-dir)
#   <sources-dir>  the lre-image-sources artifact (gpl/pack.py's parts,
#                  index and parts.jsonl)
# Env: GH_TOKEN (contents: write), REPO, RUN_ID, RUN_ATTEMPT, SHA, SERVER_URL,
#      FRESH (true when built from fresh inputs). Markdown on stdout.
set -euo pipefail
export LC_ALL=C

IMAGE="$(cd "${1:?usage: publish.sh <image-dir> <sources-dir>}" && pwd)"
SOURCES="$(cd "${2:?usage: publish.sh <image-dir> <sources-dir>}" && pwd)"
HERE="$(cd "$(dirname "$0")" && pwd)"
: "${GH_TOKEN:?}" "${REPO:?}" "${RUN_ID:?}" "${RUN_ATTEMPT:?}" "${SHA:?}" "${SERVER_URL:?}" "${FRESH:?}"

mapfile -t found < <(find "$IMAGE" -maxdepth 1 -name 'phonecando-linux-default-*.json')
[ "${#found[@]}" = 1 ] || { echo "::error::want one manifest in $IMAGE, found ${#found[@]}"; exit 1; }
manifest="${found[0]}"
version="$(jq -r .version "$manifest")"
asset="$(jq -r .asset "$manifest")"
sha256="$(jq -r .sha256 "$manifest")"
name="phonecando-linux-default-$version"
tag="linux-image-$version"
work="$(mktemp -d "${RUNNER_TEMP:-/tmp}/publish.XXXXXX")"

echo "### Publish \`$tag\`"
echo

# 1. The tag already exists?
if state="$(gh release view "$tag" -R "$REPO" --json isDraft --jq .isDraft 2> /dev/null)"; then
  if [ "$state" = true ]; then
    echo "Deleting the draft a failed attempt left."
    gh release delete "$tag" -R "$REPO" --yes
  else
    gh release download "$tag" -R "$REPO" -D "$work/existing" -p "$name.json"
    if [ "$(jq -r .sha256 "$work/existing/$name.json")" = "$sha256" ]; then
      echo "Already published with the same sha256 \`$sha256\`: nothing to do."
      exit 0
    fi
    echo "::error::$tag is published with other bytes than this build: the build is not reproducible"
    exit 1
  fi
fi

# 2. Fresh inputs: anything new since the newest published image?
if [ "$FRESH" = true ]; then
  newest="$(gh release list -R "$REPO" --limit 100 --json tagName,isDraft,createdAt \
    --jq '[.[] | select(.isDraft | not) | select(.tagName | startswith("linux-image-"))] | sort_by(.createdAt) | last | .tagName // ""')"
  if [ -n "$newest" ]; then
    nv="${newest#linux-image-}"
    gh release download "$newest" -R "$REPO" -D "$work/newest" \
      -p "phonecando-linux-default-$nv.json" -p "phonecando-linux-default-$nv-packages.tsv"
    nm="$work/newest/phonecando-linux-default-$nv.json"
    if [ "$(jq -r .debian.digest "$nm")" = "$(jq -r .debian.digest "$manifest")" ] &&
       [ "$(jq -r .recipe_sha256 "$nm")" = "$(jq -r .recipe_sha256 "$manifest")" ] &&
       cmp -s "$work/newest/phonecando-linux-default-$nv-packages.tsv" "$IMAGE/packages.tsv"; then
      echo "Same base image, recipe and package versions as \`$newest\`: nothing new, so no new image. Keep the image you have locked, or lock \`$newest\`'s run."
      exit 0
    fi
  fi
fi

# 3. Stage the assets under their release names, with the final manifest.
stage="$work/stage"
mkdir -p "$stage"
cp "$IMAGE/$asset" "$IMAGE/$asset.sha256" "$stage/"
cp "$IMAGE/packages.tsv" "$stage/$name-packages.tsv"
jq -s '.' "$SOURCES/parts.jsonl" > "$work/sources.json"
while read -r part; do
  cp "$SOURCES/$part" "$stage/"
done < <(jq -r '.[].asset' "$work/sources.json")
jq --arg tag "$tag" --argjson run "$RUN_ID" --argjson attempt "$RUN_ATTEMPT" --arg sha "$SHA" \
  --arg url "$SERVER_URL/$REPO/actions/runs/$RUN_ID" --slurpfile sources "$work/sources.json" \
  --arg packages "$name-packages.tsv" \
  '. + {release: $tag, packages_asset: $packages, sources: $sources[0],
        run: {id: $run, attempt: $attempt, url: $url, commit: $sha}}' \
  "$manifest" > "$stage/$name.json"
bash "$HERE/notes.sh" "$stage/$name.json" > "$work/notes.md"

gh release create "$tag" -R "$REPO" --draft --prerelease --latest=false --target "$SHA" \
  --title "Linux image $version (Default env)" --notes-file "$work/notes.md" "$stage"/*

want="$(cd "$stage" && find . -maxdepth 1 -type f -printf '%f %s\n' | sort)"
got="$(gh release view "$tag" -R "$REPO" --json assets --jq '.assets[] | "\(.name) \(.size)"' | sort)"
if [ "$want" != "$got" ]; then
  echo "::error::$tag (draft) does not hold every asset at its size; left as a draft"
  diff <(echo "$want") <(echo "$got") || true
  exit 1
fi
gh release edit "$tag" -R "$REPO" --draft=false --prerelease --latest=false
latest="$(gh api "repos/$REPO/releases/latest" --jq .tag_name 2> /dev/null || true)"
if [ "$latest" = "$tag" ]; then
  echo "::error::$tag became the latest release; app updates read releases/latest. Fix by hand now."
  exit 1
fi

echo "| Asset | Bytes |"
echo "|---|---|"
while read -r f s; do echo "| \`$f\` | $s |"; done <<<"$want"
echo
echo "Published prerelease \`$tag\` (latest is still \`${latest:-none}\`). Lock it with \`./manage image lock $RUN_ID\`."
