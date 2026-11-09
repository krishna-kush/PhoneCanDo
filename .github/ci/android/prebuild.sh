#!/usr/bin/env bash
# Generate app/android on a CI runner (CNG: the folder is gitignored) and
# check that every PhoneCanDo config plugin left its mark in the output.
#   prebuild.sh           install the app's JS deps, run prebuild, check
#   prebuild.sh --again   re-run prebuild over the result and require it to be
#                         byte-identical (app/plugins/gradleBlock.js promises
#                         repeated prebuilds are)
# Run from the repo root, on CI only: locally, prebuild would rewrite the
# our local app/android.
set -euo pipefail

export CI=1 EXPO_NO_GIT_STATUS=1 EXPO_NO_TELEMETRY=1
# Expo CLI 57 deletes and regenerates app/android unless --no-clean is passed;
# on a fresh runner there is nothing to keep, but the release scripts use the
# same flags, so CI exercises the same path.
prebuild() { (cd app && pnpm exec expo prebuild -p android --no-install --no-clean); }

if [ "${1:-}" = --again ]; then
  [ -d app/android ] || { echo "prebuild.sh --again: run prebuild.sh first" >&2; exit 1; }
  before="${RUNNER_TEMP:-/tmp}/android-first-prebuild"
  rm -rf "$before"
  cp -a app/android "$before"
  prebuild
  if ! diff -r "$before" app/android >"${RUNNER_TEMP:-/tmp}/prebuild-again.diff"; then
    echo "::error title=Prebuild is not idempotent::a second prebuild --no-clean changed app/android"
    cat "${RUNNER_TEMP:-/tmp}/prebuild-again.diff"
    exit 1
  fi
  echo "[prebuild] second run is byte-identical"
  exit 0
fi

pnpm -C app install --frozen-lockfile
prebuild

# What each plugin must have written (app/plugins/*.js). A missing mark means
# a plugin silently stopped applying: fail here, not 40 minutes into Gradle.
missing=()
need() { # file, fixed string, plugin
  if [ ! -f "app/android/$1" ] || ! grep -qF -- "$2" "app/android/$1"; then
    missing+=("$3: '$2' not in app/android/$1")
  fi
}
need app/build.gradle '// phonecando: channels begin' withBuildChannel
need app/build.gradle '// phonecando: debuggable variants begin' withBuildChannel
need app/build.gradle '// phonecando: release signing begin' withReleaseSigning
need app/build.gradle 'signingConfig signingConfigs.release' withReleaseSigning
need app/build.gradle '// phonecando: dev app id begin' withDevAppId
need app/build.gradle '// phonecando: stored assets begin' withStoredAssets
need settings.gradle '// phonecando: build the PCE from source begin' withPceCompositeBuild
need settings.gradle '// phonecando: build the Linux runtime from source begin' withLreCompositeBuild
need settings.gradle '// phonecando: build the agent integrations from source begin' withAgentsCompositeBuild
need gradle.properties 'reactNativeArchitectures=' withBuildPerf
need build.gradle '// phonecando: min sdk begin' withMinSdk
need app/src/full/AndroidManifest.xml 'PhoneCanDoAccessibilityService' withBuildChannel
need app/src/play/AndroidManifest.xml 'REQUEST_INSTALL_PACKAGES' withBuildChannel
need app/src/liteDebug/res/values/strings.xml 'PhoneCanDo Lite Dev' withDevAppId
need app/src/main/res/xml/network_security_config.xml '127.0.0.1' withLoopbackCleartext
need app/src/main/AndroidManifest.xml 'android:extractNativeLibs="true"' withExtractNativeLibs
need app/src/main/AndroidManifest.xml 'android:networkSecurityConfig=' withLoopbackCleartext
need app/src/main/AndroidManifest.xml 'com.phonecando.channel' withBuildChannel
if [ "${#missing[@]}" -gt 0 ]; then
  for m in "${missing[@]}"; do echo "::error title=Config plugin output missing::$m"; done
  exit 1
fi
echo "[prebuild] app/android generated; all config plugin blocks present"
