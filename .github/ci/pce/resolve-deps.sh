#!/usr/bin/env bash
# Second source of truth for the PCE dependency law: asks Gradle for the
# resolved project dependencies of every module (main and test classpaths) and
# writes one report per configuration to <out-dir>/<configuration>.txt for
# `check-deps.mjs --resolved`. Modules come from settings.gradle.kts; a module
# whose build file applies com.android.* gets the Android variant names.
# Usage (from pce/): resolve-deps.sh <out-dir> [extra gradle args...]
set -euo pipefail

out=${1:?usage: resolve-deps.sh <out-dir> [gradle args...]}
shift
extra=("$@")
mkdir -p "$out"

jvm=()
android=()
for m in $(grep -oE '"(:[A-Za-z0-9_-]+)"' settings.gradle.kts | tr -d '":'); do
  if grep -q 'com\.android\.' "$m/build.gradle.kts"; then android+=("$m"); else jvm+=("$m"); fi
done
echo "jvm modules: ${jvm[*]}"
echo "android modules: ${android[*]}"

# One Gradle invocation per configuration, sequential so the per-module
# sections ("Project ':m'") never interleave.
report() {
  local config=$1
  shift
  local tasks=()
  for m in "$@"; do tasks+=(":$m:dependencies" --configuration "$config"); done
  echo "resolving $config"
  ./gradlew -q --no-parallel "${tasks[@]}" "${extra[@]}" >"$out/$config.txt"
}

for config in compileClasspath runtimeClasspath testCompileClasspath testRuntimeClasspath; do
  report "$config" "${jvm[@]}"
done
for config in releaseCompileClasspath releaseRuntimeClasspath debugUnitTestRuntimeClasspath debugAndroidTestRuntimeClasspath; do
  report "$config" "${android[@]}"
done
