#!/usr/bin/env bash
# Build llama.cpp's llama-server for Android arm64 from pinned sources
# (pins.env) with our patches (patches/*.patch, in name order): CPU only,
# static (no shared ggml/llama libs, libc++ linked in), NEEDED system libs
# only, 16 KB pages, KleidiAI kernels on.
#
# Usage: ANDROID_NDK_HOME=<ndk r28c> [JOBS=n] lme/llamacpp/build.sh <workdir> <out-dir>
#   <workdir>  downloads cache (<workdir>/downloads, sha256-verified, reused)
#              and the build trees (<workdir>/android, rebuilt every run)
#   <out-dir>  gets libllama-server.so (stripped, 0755) and INPUTS, the
#              digest of what it was built from (pins.env, this script and
#              the patches)
#   JOBS       parallel compile jobs (default: the CPU count); each needs
#              up to about 1.5 GB of RAM on the server's biggest files
#
# Check the output with lme/llamacpp/verify.sh <out-dir>; stage it with
# lme/llamacpp/stage.sh. Host tools: cmake (3.22+), ninja, curl, tar,
# sha256sum, patch.
set -euo pipefail
export LC_ALL=C TZ=UTC
umask 022

WORK="${1:?usage: build.sh <workdir> <out-dir>}"
OUT="${2:?usage: build.sh <workdir> <out-dir>}"
: "${ANDROID_NDK_HOME:?ANDROID_NDK_HOME must point at the Android NDK (pins.env NDK_VERSION)}"
JOBS="${JOBS:-$(nproc 2>/dev/null || echo 2)}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=pins.env
. "$HERE/pins.env"
for k in LLAMACPP_VERSION LLAMACPP_URL LLAMACPP_SHA256 KLEIDIAI_VERSION KLEIDIAI_URL KLEIDIAI_SHA256 \
         ANDROID_API NDK_VERSION CPU_ARCH; do
  if [ -z "${!k:-}" ]; then echo "build FAIL: $k missing from $HERE/pins.env" >&2; exit 1; fi
done
for t in cmake ninja curl tar sha256sum patch; do
  command -v "$t" >/dev/null || { echo "build FAIL: $t not found" >&2; exit 1; }
done

# Same NDK, same bytes: a different clang is a different build.
ndk_release="$(sed -n 's/^Pkg\.ReleaseName *= *//p' "$ANDROID_NDK_HOME/source.properties" 2>/dev/null || true)"
if [ "$ndk_release" != "$NDK_VERSION" ]; then
  echo "build FAIL: $ANDROID_NDK_HOME is NDK '${ndk_release:-unknown}', pins.env wants $NDK_VERSION" >&2
  exit 1
fi
case "$(uname -s)" in
  Linux) host=linux-x86_64 ;;
  Darwin) host=darwin-x86_64 ;;
  *) echo "build FAIL: no NDK prebuilt toolchain for $(uname -s)" >&2; exit 1 ;;
esac
STRIP="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/$host/bin/llvm-strip"
[ -x "$STRIP" ] || { echo "build FAIL: $STRIP not found" >&2; exit 1; }

mkdir -p "$WORK/downloads" "$OUT"
WORK="$(cd "$WORK" && pwd)"
OUT="$(cd "$OUT" && pwd)"
ROOT="$WORK/android"

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

unpack_fresh() {
  rm -rf "$2"
  mkdir -p "$2"
  tar -xzf "$1" -C "$2" --strip-components=1 --no-same-owner
}

LLAMA_TARBALL="$WORK/downloads/llama.cpp-$LLAMACPP_VERSION.tar.gz"
KLEIDIAI_TARBALL="$WORK/downloads/kleidiai-$KLEIDIAI_VERSION-src.tar.gz"
fetch_verified "$LLAMA_TARBALL" "$LLAMACPP_SHA256" "$LLAMACPP_URL"
fetch_verified "$KLEIDIAI_TARBALL" "$KLEIDIAI_SHA256" "$KLEIDIAI_URL"

rm -rf "$ROOT"
unpack_fresh "$LLAMA_TARBALL" "$ROOT/llama.cpp"
unpack_fresh "$KLEIDIAI_TARBALL" "$ROOT/kleidiai"

# Our patches, in name order and exactly (no fuzz); one that does not apply
# ends the build, and so does a fold or a slot total that is not in place
# after them.
for p in "$HERE"/patches/*.patch; do
  echo "patch: $(basename "$p")" >&2
  patch -p1 --batch --forward --fuzz=0 --no-backup-if-mismatch -d "$ROOT/llama.cpp" <"$p" \
    || { echo "build FAIL: $(basename "$p") does not apply to llama.cpp $LLAMACPP_VERSION" >&2; exit 1; }
done
grep -qF 'workaround::fold_system_messages(params.messages)' "$ROOT/llama.cpp/common/chat.cpp" \
  || { echo "build FAIL: fold_system_messages is not in common/chat.cpp after the patches" >&2; exit 1; }
grep -qF 'res["n_prompt_tokens_total"]' "$ROOT/llama.cpp/tools/server/server-context.cpp" \
  || { echo "build FAIL: n_prompt_tokens_total is not in tools/server/server-context.cpp after the patches" >&2; exit 1; }

# llama.cpp's build-info asks git for a commit; the tarball has none, and a
# repository around the workdir must not leak its own into the binary.
export GIT_DIR=/nonexistent
# Build and NDK paths never reach the binary (ggml's asserts print
# __FILE__), so CI and a laptop build the same bytes. No build ID either:
# the linker hashes the unstripped binary, whose symbols still name the
# workdir, so two workdirs gave the same code with different IDs.
prefix_map="-ffile-prefix-map=$ROOT=. -ffile-prefix-map=$ANDROID_NDK_HOME=/ndk"

# The device spike's configuration (CPU only; GGML_NATIVE off so CPU_ARCH
# decides; no OpenMP, llamafile or OpenSSL; no web UI), plus no compiler
# cache and a release version string for the release tag.
cmake -S "$ROOT/llama.cpp" -B "$ROOT/build" -G Ninja \
  -DCMAKE_TOOLCHAIN_FILE="$ANDROID_NDK_HOME/build/cmake/android.toolchain.cmake" \
  -DANDROID_ABI=arm64-v8a \
  -DANDROID_PLATFORM="android-$ANDROID_API" \
  -DANDROID_STL=c++_static \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_C_FLAGS="$prefix_map" \
  -DCMAKE_CXX_FLAGS="$prefix_map" \
  -DCMAKE_EXE_LINKER_FLAGS="-Wl,-z,max-page-size=16384 -Wl,--build-id=none" \
  -DBUILD_SHARED_LIBS=OFF \
  -DGGML_NATIVE=OFF \
  -DGGML_CCACHE=OFF \
  -DGGML_OPENMP=OFF \
  -DGGML_LLAMAFILE=OFF \
  -DGGML_CPU_ARM_ARCH="$CPU_ARCH" \
  -DGGML_CPU_KLEIDIAI=ON \
  -DFETCHCONTENT_SOURCE_DIR_KLEIDIAI="$ROOT/kleidiai" \
  -DFETCHCONTENT_FULLY_DISCONNECTED=ON \
  -DLLAMA_BUILD_IS_DEV=OFF \
  -DLLAMA_OPENSSL=OFF \
  -DLLAMA_BUILD_UI=OFF \
  -DLLAMA_USE_PREBUILT_UI=OFF \
  -DLLAMA_BUILD_APP=OFF \
  -DLLAMA_BUILD_TESTS=OFF \
  -DLLAMA_BUILD_EXAMPLES=OFF

cmake --build "$ROOT/build" --config Release -j "$JOBS" --target llama-server

"$STRIP" --strip-all -o "$OUT/libllama-server.so" "$ROOT/build/bin/llama-server"
chmod 0755 "$OUT/libllama-server.so"
(cd "$HERE" && sha256sum pins.env build.sh patches/*.patch) | sha256sum | cut -d' ' -f1 > "$OUT/INPUTS"

echo "--- built (android arm64, api-$ANDROID_API, $CPU_ARCH, llama.cpp $LLAMACPP_VERSION with our patches, kleidiai $KLEIDIAI_VERSION) ---"
(cd "$OUT" && ls -l libllama-server.so && sha256sum libllama-server.so)
