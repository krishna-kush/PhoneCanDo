#!/usr/bin/env bash
# Free root-disk space on a GitHub-hosted Ubuntu runner before an Android
# build: React Native's native code, the pinned NDK, Gradle caches and the
# APKs need roughly 15 GB. Removes toolchains android.yml never uses; never
# touches the Android SDK, Java or Node. Best effort: a missing directory or
# a failed removal only costs space.
set -uo pipefail

free() { df -h / | awk 'NR == 2 { print $4 }'; }
echo "[free-disk] before: $(free) free on /"
for dir in \
  /usr/share/dotnet \
  /opt/ghc \
  /usr/local/.ghcup \
  /usr/share/swift \
  /opt/hostedtoolcache/CodeQL \
  /usr/local/share/powershell; do
  [ -e "$dir" ] && sudo rm -rf "$dir" &
done
wait
echo "[free-disk] after:  $(free) free on /"
