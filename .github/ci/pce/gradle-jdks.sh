#!/usr/bin/env bash
# Makes every JDK that actions/setup-java (or the runner image) installed
# visible to Gradle toolchain resolution. The PCE pins jvmToolchain(17) and has
# no auto-provisioning, so Gradle must find JDK 17 (and, in the JVM matrix, the
# test JDK) locally; hosted-tool-cache JDKs on Windows/macOS are not in Gradle's
# auto-detect paths. setup-java exports JAVA_HOME_<major>_<arch>; this lists
# those variables in the Gradle user home's gradle.properties. Run it after
# setup-gradle: a Gradle user home that already exists blocks its cache restore.
set -euo pipefail

# Arch suffix casing differs between setup-java and runner images (X64, ARM64, arm64).
vars=$(env | grep -oE '^JAVA_HOME_[0-9]+_[A-Za-z0-9]+=' | tr -d '=' | sort -u | paste -sd, - || true)
if [[ -z "$vars" ]]; then
  echo "::warning title=PCE toolchains::no JAVA_HOME_<major>_<arch> variables found; relying on Gradle auto-detection"
  exit 0
fi
home=${GRADLE_USER_HOME:-$HOME/.gradle}
mkdir -p "$home"
echo "org.gradle.java.installations.fromEnv=$vars" >>"$home/gradle.properties"
echo "Gradle toolchains from env: $vars"
