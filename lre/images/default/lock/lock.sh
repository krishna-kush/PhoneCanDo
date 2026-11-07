#!/usr/bin/env bash
# Lock the Default env image a green lre-image run published: rewrite
# lre/images/default/lock.json from that run's release, so the next APK
# ships exactly that image. Refuses a run that is not lre-image.yml on prod,
# not completed green, or whose publish job did not succeed. Read-only on
# GitHub (gh api, gh release download); you commit lock.json.
#
# Usage: lre/images/default/lock/lock.sh <run-id>
#   <run-id>  the number in .../actions/runs/<run-id>
# Env: GITHUB_REPO (default: REPO in app/src/engine/updates.ts). Needs gh
# (logged in) and jq.
set -euo pipefail
export LC_ALL=C

RUN="${1:?usage: lock.sh <run-id>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../../.." && pwd)"
LOCK="$HERE/../lock.json"
WORKFLOW=.github/workflows/lre-image.yml

die() { echo "lock: $*" >&2; exit 1; }
[[ "$RUN" =~ ^[1-9][0-9]*$ ]] || die "the run id must be a number, got '$RUN'"
repo="${GITHUB_REPO:-$(sed -n "s/^const REPO = '\([^']*\)'.*/\1/p" "$ROOT/app/src/engine/updates.ts")}"
[ -n "$repo" ] || die "no repo (set GITHUB_REPO or check app/src/engine/updates.ts)"

run="$(gh api "repos/$repo/actions/runs/$RUN")" || die "run $RUN not found in $repo"
field() { jq -r ".$1 // \"\"" <<<"$run"; }
[ "$(field path)" = "$WORKFLOW" ] || die "run $RUN is $(field path), not $WORKFLOW"
[ "$(field head_branch)" = prod ] || die "run $RUN ran on '$(field head_branch)', not prod"
[ "$(field status)" = completed ] || die "run $RUN is $(field status), not completed"
[ "$(field conclusion)" = success ] || die "run $RUN concluded '$(field conclusion)', not success: nothing green to lock"
publish="$(gh api "repos/$repo/actions/runs/$RUN/jobs?per_page=100" \
  --jq '[.jobs[] | select(.name == "publish")][0].conclusion // ""')"
[ "$publish" = success ] || die "run $RUN's publish job is '${publish:-missing}': it published no image"

tag="$(gh api --paginate "repos/$repo/releases?per_page=100" \
  --jq ".[] | select(.tag_name | startswith(\"linux-image-\")) | select((.body // \"\") | contains(\"phonecando-run-id: $RUN \")) | .tag_name" \
  | head -n 1)"
[ -n "$tag" ] || die "no linux-image-* release names run $RUN"
version="${tag#linux-image-}"

tmp="$(mktemp -d)"
trap 'rm -rf -- "$tmp"' EXIT
gh release download "$tag" -R "$repo" -D "$tmp" \
  -p "phonecando-linux-default-$version.json" -p "phonecando-linux-default-$version-arm64.tar.xz.sha256"
manifest="$tmp/phonecando-linux-default-$version.json"
asset="$(jq -r .asset "$manifest")"
sha256="$(jq -r .sha256 "$manifest")"
size="$(jq -r .size "$manifest")"
[ "$(jq -r .run.id "$manifest")" = "$RUN" ] || die "the manifest in $tag names another run"
[ "$(jq -r .version "$manifest")" = "$version" ] || die "the manifest in $tag names another version"
[ "$(cut -d' ' -f1 "$tmp/$asset.sha256")" = "$sha256" ] || die "$asset.sha256 in $tag disagrees with its manifest"
gh api "repos/$repo/releases/tags/$tag" \
  --jq ".assets[] | select(.name == \"$asset\" and .size == $size) | .name" | grep -qx "$asset" \
  || die "$tag holds no $asset of $size bytes"

old="$(jq -r '.version // "none"' "$LOCK")"
jq -n --arg version "$version" --arg release "$tag" --arg asset "$asset" --arg repo "$repo" \
  --arg sha256 "$sha256" --argjson size "$size" --argjson run "$RUN" \
  --arg digest "$(jq -r .debian.digest "$manifest")" --arg snapshot "$(jq -r .debian.snapshot "$manifest")" \
  '{version: $version, release: $release, asset: $asset,
    url: "https://github.com/\($repo)/releases/download/\($release)/\($asset)",
    repo: $repo, sha256: $sha256, size: $size, debian_digest: $digest, snapshot: $snapshot, run_id: $run}' \
  > "$LOCK.part"
cp "$LOCK" "$tmp/lock.json.old"
mv "$LOCK.part" "$LOCK"
if ! bash "$HERE/check.sh" --locked --remote; then
  cp "$tmp/lock.json.old" "$LOCK"
  die "the new lock does not check out against GitHub; lock.json is unchanged"
fi
echo "locked $old -> $version. Commit lre/images/default/lock.json; then ./manage image fetch && ./manage image stage."
