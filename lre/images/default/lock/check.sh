#!/usr/bin/env bash
# Check lre/images/default/lock.json, the "last known good" Default env image
# the APK ships. Either every field is null (nothing locked yet) or every
# field is set, well-formed and consistent: release linux-image-<version>,
# asset phonecando-linux-default-<version>-arm64.tar.xz, url the GitHub
# release download of that asset in repo.
#
# Usage: lre/images/default/lock/check.sh [--locked] [--remote]
#   --locked  nothing locked is an error (builds that must ship an image)
#   --remote  also ask GitHub, read-only: the release exists, is a
#             prerelease and not the latest release (our updater reads
#             releases/latest), holds the asset at that size, and its
#             manifest names this sha256, version and run id
# Prints one line; exit 0 when valid, 1 when not, 3 when nothing is locked
# and --locked was given. Env: GH_TOKEN/GITHUB_TOKEN (optional, rate limit).
set -euo pipefail
export LC_ALL=C

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCK="$HERE/../lock.json"
locked_required=false remote=false
for arg in "$@"; do
  case "$arg" in
    --locked) locked_required=true ;;
    --remote) remote=true ;;
    *) echo "usage: check.sh [--locked] [--remote]" >&2; exit 2 ;;
  esac
done

bad() { echo "lock.json: $*" >&2; exit 1; }

fields='["version","release","asset","url","repo","sha256","size","debian_digest","snapshot","run_id"]'
jq -e --argjson f "$fields" '(keys | sort) == ($f | sort)' "$LOCK" > /dev/null \
  || bad "want exactly the keys $fields"
nulls="$(jq '[.[] | select(. == null)] | length' "$LOCK")"
if [ "$nulls" = 10 ]; then
  echo "lock.json: no image locked yet (./manage image lock <run-id> after a publishing lre-image run)"
  if $locked_required; then exit 3; fi
  exit 0
fi
[ "$nulls" = 0 ] || bad "$nulls fields are null; either all are set or none"

get() { jq -r ".$1" "$LOCK"; }
version="$(get version)" release="$(get release)" asset="$(get asset)" url="$(get url)"
repo="$(get repo)" sha256="$(get sha256)" size="$(get size)" digest="$(get debian_digest)"
snapshot="$(get snapshot)" run_id="$(get run_id)"

[[ "$version" =~ ^[0-9]{8}-[0-9a-f]{8}$ ]] || bad "version '$version' is not <YYYYMMDD>-<8 hex>"
[ "$release" = "linux-image-$version" ] || bad "release '$release' is not linux-image-$version"
[ "$asset" = "phonecando-linux-default-$version-arm64.tar.xz" ] || bad "asset '$asset' does not match the version"
[[ "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || bad "repo '$repo' is not owner/name"
[ "$url" = "https://github.com/$repo/releases/download/$release/$asset" ] || bad "url is not the release download of the asset"
[[ "$sha256" =~ ^[0-9a-f]{64}$ ]] || bad "sha256 is not 64 hex digits"
[[ "$size" =~ ^[1-9][0-9]*$ ]] || bad "size is not a positive integer"
[[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || bad "debian_digest is not sha256:<64 hex>"
[[ "$snapshot" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || bad "snapshot is not YYYYMMDDTHHMMSSZ"
[[ "$run_id" =~ ^[1-9][0-9]*$ ]] || bad "run_id is not a run number"
[ "${snapshot:0:8}" = "${version:0:8}" ] || bad "version date and snapshot date differ"

if $remote; then
  api() {
    local token="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
    curl -fsSL --retry 3 -H 'Accept: application/vnd.github+json' \
      ${token:+-H "Authorization: Bearer $token"} "https://api.github.com/repos/$repo/$1"
  }
  rel="$(api "releases/tags/$release")" || bad "release $release not found in $repo"
  jq -e '.prerelease == true and .draft == false' <<<"$rel" > /dev/null || bad "$release is not a published prerelease"
  latest="$(api releases/latest | jq -r '.tag_name' || true)"
  [ "$latest" != "$release" ] || bad "$release is marked latest; that breaks app updates"
  jq -e --arg a "$asset" --argjson s "$size" '[.assets[] | select(.name == $a and .size == $s)] | length == 1' \
    <<<"$rel" > /dev/null || bad "$release has no $asset of $size bytes"
  murl="$(jq -r --arg n "phonecando-linux-default-$version.json" '.assets[] | select(.name == $n) | .browser_download_url' <<<"$rel")"
  [ -n "$murl" ] || bad "$release has no manifest"
  manifest="$(curl -fsSL --retry 3 "$murl")" || bad "cannot download the manifest of $release"
  jq -e --arg sha "$sha256" --arg v "$version" --argjson run "$run_id" --arg d "$digest" \
    '.sha256 == $sha and .version == $v and .run.id == $run and .debian.digest == $d' <<<"$manifest" > /dev/null \
    || bad "the manifest in $release disagrees with lock.json"
fi
note=""
if $remote; then note=", matches its GitHub release"; fi
echo "lock.json: $version ($asset, $size bytes, run $run_id)$note"
