#!/usr/bin/env bash
# Build llama.cpp's llama-server for the Linux host (glibc, x86_64 or
# aarch64) from the same pinned sources and patches as the phone's (pins.env,
# patches/*.patch): CPU only, static ggml and llama, the same switches as
# build.sh minus the Android and Arm-only parts. CI's local-model check (.github/workflows/local-models.yml)
# serves its test models with it; nothing ships it.
#
# Usage: [JOBS=n] lme/llamacpp/build-host.sh <workdir> <out-dir>
#   <workdir>  downloads cache (<workdir>/downloads, sha256-verified, reused)
#              and the build tree (<workdir>/host, rebuilt every run)
#   <out-dir>  gets llama-server (stripped, 0755) and INPUTS, the digest of
#              what it was built from (pins.env, this script and the patches)
#   JOBS       parallel compile jobs (default: the CPU count); each needs
#              up to about 1.5 GB of RAM on the server's biggest files
#
# GGML_NATIVE is off, so the binary runs on any CPU of the runner's kind
# (x86_64: ggml's default AVX2 set), not only the one that built it: CI
# caches it by INPUTS across runners. Host tools: cmake (3.22+), ninja, a C
# and C++ compiler, curl, tar, sha256sum, strip, patch.
set -euo pipefail
export LC_ALL=C TZ=UTC
umask 022

WORK="${1:?usage: build-host.sh <workdir> <out-dir>}"
OUT="${2:?usage: build-host.sh <workdir> <out-dir>}"
JOBS="${JOBS:-$(nproc 2>/dev/null || echo 2)}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=pins.env
. "$HERE/pins.env"
for k in LLAMACPP_VERSION LLAMACPP_URL LLAMACPP_SHA256; do
  if [ -z "${!k:-}" ]; then echo "build FAIL: $k missing from $HERE/pins.env" >&2; exit 1; fi
done
for t in cmake ninja curl tar sha256sum strip patch; do
  command -v "$t" >/dev/null || { echo "build FAIL: $t not found" >&2; exit 1; }
done
[ "$(uname -s)" = Linux ] || { echo "build FAIL: a Linux host build, not $(uname -s)" >&2; exit 1; }

mkdir -p "$WORK/downloads" "$OUT"
WORK="$(cd "$WORK" && pwd)"
OUT="$(cd "$OUT" && pwd)"
ROOT="$WORK/host"

sha256_of() { sha256sum "$1" | cut -d' ' -f1; }

# fetch_verified <dest> <sha256> <url>: a verified copy already there is reused.
fetch_verified() {
  local dest="$1" want="$2" url="$3" got
  if [ -f "$dest" ] && [ "$(sha256_of "$dest")" = "$want" ]; then
    echo "cached: $(basename "$dest") (sha256 ok)" >&2
    return 0
  fi
  rm -f "$dest" "$dest.part"
  echo "fetch: $url" >&2
  curl -fsSL --retry 2 --retry-delay 5 --connect-timeout 20 --max-time 600 -o "$dest.part" "$url"
  got="$(sha256_of "$dest.part")"
  if [ "$got" != "$want" ]; then
    rm -f "$dest.part"
    echo "fetch FAIL: sha256 mismatch from $url (want $want, got $got)" >&2
    return 1
  fi
  mv "$dest.part" "$dest"
}

LLAMA_TARBALL="$WORK/downloads/llama.cpp-$LLAMACPP_VERSION.tar.gz"
fetch_verified "$LLAMA_TARBALL" "$LLAMACPP_SHA256" "$LLAMACPP_URL"

rm -rf "$ROOT"
mkdir -p "$ROOT/llama.cpp"
tar -xzf "$LLAMA_TARBALL" -C "$ROOT/llama.cpp" --strip-components=1 --no-same-owner

# As build.sh: our patches, in name order and exactly (no fuzz); one that
# does not apply ends the build, and so does a fold or a slot total that is
# not in place.
for p in "$HERE"/patches/*.patch; do
  echo "patch: $(basename "$p")" >&2
  patch -p1 --batch --forward --fuzz=0 --no-backup-if-mismatch -d "$ROOT/llama.cpp" <"$p" \
    || { echo "build FAIL: $(basename "$p") does not apply to llama.cpp $LLAMACPP_VERSION" >&2; exit 1; }
done
grep -qF 'workaround::fold_system_messages(params.messages)' "$ROOT/llama.cpp/common/chat.cpp" \
  || { echo "build FAIL: fold_system_messages is not in common/chat.cpp after the patches" >&2; exit 1; }
grep -qF 'res["n_prompt_tokens_total"]' "$ROOT/llama.cpp/tools/server/server-context.cpp" \
  || { echo "build FAIL: n_prompt_tokens_total is not in tools/server/server-context.cpp after the patches" >&2; exit 1; }

# As build.sh: no git commit in build-info, no build paths in the binary.
export GIT_DIR=/nonexistent
prefix_map="-ffile-prefix-map=$ROOT=."

# build.sh's configuration (CPU only; no OpenMP, llamafile or OpenSSL; no
# web UI) without the NDK, the Arm arch pin and KleidiAI.
cmake -S "$ROOT/llama.cpp" -B "$ROOT/build" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_C_FLAGS="$prefix_map" \
  -DCMAKE_CXX_FLAGS="$prefix_map" \
  -DBUILD_SHARED_LIBS=OFF \
  -DGGML_NATIVE=OFF \
  -DGGML_CCACHE=OFF \
  -DGGML_OPENMP=OFF \
  -DGGML_LLAMAFILE=OFF \
  -DLLAMA_BUILD_IS_DEV=OFF \
  -DLLAMA_OPENSSL=OFF \
  -DLLAMA_BUILD_UI=OFF \
  -DLLAMA_USE_PREBUILT_UI=OFF \
  -DLLAMA_BUILD_APP=OFF \
  -DLLAMA_BUILD_TESTS=OFF \
  -DLLAMA_BUILD_EXAMPLES=OFF

cmake --build "$ROOT/build" --config Release -j "$JOBS" --target llama-server

strip --strip-all -o "$OUT/llama-server" "$ROOT/build/bin/llama-server"
chmod 0755 "$OUT/llama-server"
(cd "$HERE" && sha256sum pins.env build-host.sh patches/*.patch) | sha256sum | cut -d' ' -f1 > "$OUT/INPUTS"

echo "--- built ($(uname -m) Linux host, llama.cpp $LLAMACPP_VERSION with our patches) ---"
(cd "$OUT" && ls -l llama-server && sha256sum llama-server)
