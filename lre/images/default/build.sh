#!/usr/bin/env bash
# Build the Default env image (a Debian-based arm64 rootfs) with docker:
#   1. bake  recipe/bake.sh in a container of the pinned debian image
#   2. docker export of that container (the raw rootfs)
#   3. pack  recipe/pack.sh in a container of the baked image: the
#            deterministic tar, xz, sha256, package and source lists
#   4. the manifest (JSON) from the inputs and pack's sizes
# Same inputs (inputs.sh) give the same bytes; check an image with verify.py.
#
# Usage: lre/images/default/build.sh <out-dir> [--fresh]
#   <out-dir>  gets phonecando-linux-default-<VERSION>-<arch>.tar.xz and its
#              .sha256, phonecando-linux-default-<VERSION>.json (manifest),
#              packages.tsv, sources.tsv and inputs.env; a previous build's
#              files there are replaced
#   --fresh    newest upstream digest and today's snapshot (inputs.sh)
# Env: PLATFORM     default linux/arm64, what we ship; another platform is
#                   for local tests only (its digest via DEBIAN_DIGEST)
#      XZ_THREADS   default nproc, at most 4 (the bytes do not depend on it;
#                   each thread needs ~700 MiB)
#      DEBIAN_DIGEST, SNAPSHOT   override pins.env (inputs.sh)
#      KEEP_TAR=1   also keep the uncompressed rootfs.tar
# Needs docker (arm64 emulation on other hosts: qemu-user binfmt) and jq.
set -euo pipefail
export LC_ALL=C

OUT="${1:?usage: build.sh <out-dir> [--fresh]}"
shift
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM="${PLATFORM:-linux/arm64}"
ARCH="${PLATFORM#linux/}"
threads="${XZ_THREADS:-$(nproc)}"
[ "$threads" -gt 4 ] && threads=4

mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
bash "$HERE/inputs.sh" "$@" > "$OUT/inputs.env.part"
mv "$OUT/inputs.env.part" "$OUT/inputs.env"
while IFS='=' read -r key value; do
  printf -v "$key" '%s' "$value"
done < "$OUT/inputs.env"

NAME="phonecando-linux-default-$VERSION"
ASSET="$NAME-$ARCH.tar.xz"
IMAGE="debian@$DEBIAN_DIGEST"
WORK="$OUT/.work"
rm -rf "$WORK"
rm -f "$OUT"/phonecando-linux-default-* "$OUT"/packages.tsv "$OUT"/sources.tsv \
      "$OUT"/pack.env "$OUT"/rootfs.tar
mkdir -p "$WORK"

cid="" baked=""
cleanup() {
  [ -n "$cid" ] && docker rm -f "$cid" > /dev/null 2>&1
  [ -n "$baked" ] && docker rmi -f "$baked" > /dev/null 2>&1
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "--- build $NAME ($PLATFORM) from $IMAGE, snapshot $SNAPSHOT ---"
start=$SECONDS
docker pull --quiet --platform "$PLATFORM" "$IMAGE"

cid="$(docker create --platform "$PLATFORM" -v "$HERE/recipe:/recipe:ro" \
  -e SNAPSHOT="$SNAPSHOT" -e SOURCE_DATE_EPOCH="$SOURCE_DATE_EPOCH" -e DEBIAN_TAG="$DEBIAN_TAG" \
  -e DEBIAN_DIGEST="$DEBIAN_DIGEST" -e RECIPE_SHA256="$RECIPE_SHA256" -e IMAGE_VERSION="$VERSION" \
  "$IMAGE" bash /recipe/bake.sh)"
docker start --attach "$cid"
docker export --output "$WORK/raw.tar" "$cid"
baked="$(docker commit "$cid")"
bake_seconds=$((SECONDS - start))

docker run --rm --platform "$PLATFORM" --network none \
  -v "$WORK/raw.tar:/in/raw.tar:ro" -v "$HERE/recipe:/recipe:ro" -v "$OUT:/out" \
  -e SOURCE_DATE_EPOCH="$SOURCE_DATE_EPOCH" -e ASSET="$ASSET" -e XZ_THREADS="$threads" -e KEEP_TAR="${KEEP_TAR:-0}" \
  -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
  "$baked" bash /recipe/pack.sh

while IFS='=' read -r key value; do
  printf -v "PACK_$key" '%s' "$value"
done < "$OUT/pack.env"
rm -f "$OUT/pack.env"

jq -n --arg name default --arg version "$VERSION" --arg arch "$ARCH" --arg asset "$ASSET" \
  --arg sha256 "$(cut -d' ' -f1 "$OUT/$ASSET.sha256")" \
  --argjson size "$PACK_XZ_BYTES" --argjson tar_size "$PACK_TAR_BYTES" \
  --argjson entries "$PACK_ENTRIES" --argjson packages "$(wc -l < "$OUT/packages.tsv")" \
  --arg tag "$DEBIAN_TAG" --arg digest "$DEBIAN_DIGEST" --arg snapshot "$SNAPSHOT" \
  --arg debian_version "$PACK_DEBIAN_VERSION" --argjson sde "$SOURCE_DATE_EPOCH" \
  --arg recipe "$RECIPE_SHA256" --arg xz "$PACK_XZ_VERSION" --arg tar "$PACK_TAR_VERSION" \
  '{schema: 1, name: $name, version: $version, arch: $arch, asset: $asset,
    sha256: $sha256, size: $size, tar_size: $tar_size, entries: $entries, packages: $packages,
    debian: {tag: $tag, digest: $digest, snapshot: $snapshot, version: $debian_version},
    source_date_epoch: $sde, recipe_sha256: $recipe,
    tools: {xz: $xz, tar: $tar}, xz: {preset: "9", decoder_memory_mib: 65}}' \
  > "$OUT/$NAME.json"

echo "--- built $ASSET: $PACK_XZ_BYTES bytes (tar $PACK_TAR_BYTES), bake $((bake_seconds))s, xz ${PACK_XZ_SECONDS}s, total $((SECONDS - start))s ---"
cat "$OUT/$ASSET.sha256"
