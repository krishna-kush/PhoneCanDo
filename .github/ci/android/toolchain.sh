#!/usr/bin/env bash
# Native toolchain and Gradle sizing for an app/android build on a GitHub
# Ubuntu runner (4 vCPU, 16 GB). Run from the repo root after prebuild.sh
# (the NDK version is read from the installed react-native).
#  - Gradle: user-home gradle.properties beats the project's, which
#    app/plugins/withBuildPerf.js sizes for our 9 GB dev laptop. The PCE
#    (included build) compiles with a JDK 17 toolchain; point Gradle at the
#    JDKs setup-java installed.
#  - NDK: the version React Native's catalog pins (Expo's root project reads
#    it); the runner image ships other versions.
#  - CMake 3.22.1: the AGP default the JNI modules build with; the image ships
#    3.31 and 4.x only.
#  - The SDK platform and build tools React Native's catalog compiles with,
#    so a new compileSdk never waits for AGP to download them mid-build.
set -euo pipefail

gradle_home=${GRADLE_USER_HOME:-$HOME/.gradle}
mkdir -p "$gradle_home"
cat >>"$gradle_home/gradle.properties" <<'EOF'
# .github/ci/android/toolchain.sh
org.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=1536m -Dfile.encoding=UTF-8
org.gradle.workers.max=4
kotlin.daemon.jvmargs=-Xmx2g
org.gradle.java.installations.fromEnv=JAVA_HOME_17_X64,JAVA_HOME_21_X64
EOF

catalog=$(cd app && node -p "require('path').join(require('path').dirname(require.resolve('react-native/package.json')), 'gradle/libs.versions.toml')")
ndk=$(sed -n 's/^ndkVersion *= *"\([^"]*\)".*/\1/p' "$catalog")
if [ -z "$ndk" ]; then
  echo "::error title=NDK version::no ndkVersion in $catalog"
  exit 1
fi
cmake=3.22.1
compile=$(sed -n 's/^compileSdk *= *"\([^"]*\)".*/\1/p' "$catalog")
tools=$(sed -n 's/^buildTools *= *"\([^"]*\)".*/\1/p' "$catalog")
if [ -z "$compile" ] || [ -z "$tools" ]; then
  echo "::error title=SDK version::no compileSdk or buildTools in $catalog"
  exit 1
fi

sdkmanager="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
log="${RUNNER_TEMP:-/tmp}/sdkmanager.log"
packages=("ndk;$ndk" "cmake;$cmake" "platforms;android-$compile" "build-tools;$tools")
echo "[toolchain] installing ${packages[*]}"
if ! "$sdkmanager" --install "${packages[@]}" >"$log" 2>&1; then
  tail -n 40 "$log"
  echo "::error title=sdkmanager::could not install ${packages[*]}"
  exit 1
fi
test -d "$ANDROID_HOME/ndk/$ndk" && test -x "$ANDROID_HOME/cmake/$cmake/bin/cmake"

{
  echo "### Android toolchain"
  echo ""
  echo "| Component | Version |"
  echo "| --- | --- |"
  echo "| Java (default) | $(java -version 2>&1 | head -n 1) |"
  echo "| JDK 17 for toolchains | ${JAVA_HOME_17_X64:-not set} |"
  echo "| NDK (react-native catalog) | $ndk |"
  echo "| CMake | $cmake |"
  sed -n 's/^\(compileSdk\|targetSdk\|minSdk\|buildTools\|agp\|kotlin\) *= *"\([^"]*\)".*/| \1 | \2 |/p' "$catalog"
  echo "| Gradle wrapper | $(sed -n 's/^distributionUrl=.*gradle-\(.*\)-bin\.zip/\1/p' app/android/gradle/wrapper/gradle-wrapper.properties) |"
  echo ""
} >>"${GITHUB_STEP_SUMMARY:-/dev/stdout}"
