#!/usr/bin/env bash
# Make room on a GitHub-hosted ubuntu runner for a native agent payload build
# and pick its workdir. opencode's (agents/native/opencode/docs/build.md) asks
# for ~15 GB free on a disk-backed (not tmpfs) workdir and ~2 GB RAM, and
# needs the most. The stock image fills / with SDKs this job never touches, so
# drop them: .NET, Haskell, the Android SDK (the NDK comes from setup-ndk),
# CodeQL, Swift, Boost, PowerShell. Then use whichever of $RUNNER_TEMP (on /)
# and the /mnt temp disk has more room.
# Usage: prepare-runner.sh <min-free-gb>
#   `dir=<workdir>` → $GITHUB_OUTPUT; disk/RAM table → stdout.
set -euo pipefail

min_gb="${1:?usage: prepare-runner.sh <min-free-gb>}"
: "${RUNNER_TEMP:?run inside GitHub Actions}"

free_gb() { df -BG --output=avail "$1" | tail -n1 | tr -dc '0-9'; }
fstype() { df --output=fstype "$1" | tail -n1 | tr -d ' '; }

echo "--- disk before ---" >&2
df -h / /mnt >&2 2>/dev/null || df -h / >&2
root_before="$(free_gb /)"

# Each is thousands of files and rm is I/O bound, so run them side by side.
# Best effort: a path the image no longer ships is simply skipped.
for d in /usr/share/dotnet /opt/ghc /usr/local/.ghcup /usr/local/lib/android \
         /opt/hostedtoolcache/CodeQL /usr/share/swift /usr/local/share/boost \
         /usr/local/share/powershell; do
  if [ -e "$d" ]; then sudo rm -rf "$d" & fi
done
wait

echo "--- disk after ---" >&2
df -h / /mnt >&2 2>/dev/null || df -h / >&2
root_after="$(free_gb /)"

base="$RUNNER_TEMP"
base_gb="$(free_gb "$base")"
if mountpoint -q /mnt && [ "$(fstype /mnt)" != tmpfs ] && [ "$(free_gb /mnt)" -gt "$base_gb" ]; then
  sudo mkdir -p /mnt/engine-build
  sudo chown "$(id -u):$(id -g)" /mnt/engine-build
  base=/mnt
  base_gb="$(free_gb /mnt)"
fi
work="${base%/}/engine-build"
mkdir -p "$work"

if [ "$(fstype "$work")" = tmpfs ]; then
  echo "::error::workdir $work is tmpfs; the build needs a disk-backed workdir"
  exit 1
fi
if [ "$base_gb" -lt "$min_gb" ]; then
  echo "::error::only ${base_gb} GB free for $work after cleanup; the build needs ${min_gb} GB"
  exit 1
fi

echo "dir=$work" >> "${GITHUB_OUTPUT:-/dev/null}"

mem="$(free -h | awk '/^Mem:/ { print $2 " RAM" } /^Swap:/ { print $2 " swap" }' | paste -sd, -)"
echo "### Runner"
echo
echo "| | |"
echo "|---|---|"
echo "| Free on \`/\` | ${root_before} GB → ${root_after} GB |"
echo "| Workdir | \`$work\` (${base_gb} GB free, $(fstype "$work")) |"
echo "| Memory | $mem |"
echo "| CPUs | $(nproc) |"
echo
