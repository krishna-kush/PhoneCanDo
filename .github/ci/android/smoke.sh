#!/usr/bin/env bash
# Emulator smoke test for one release-shape APK (android.yml, emulator job).
#   smoke.sh <apk-or-dir> <out-dir> <channel>
# Installs the APK, cold-starts its launcher activity with no Metro (release
# embeds the JS bundle), lets it settle, sends it home and brings it back,
# then requires: the process alive, the activity resumed, no crash, native
# crash or ANR for the package in logcat, and the accessibility service
# registered by full only. Screenshots, logcat and dumpsys output land in
# <out-dir>; a table goes to $GITHUB_STEP_SUMMARY. Exits 1 if a check failed.
# The opencode engine is arm64-only and not in the repository: the app must
# come up without it (the serve service logs "serve start failed" and stops
# itself), so nothing here waits for or asserts on the engine.
set -euo pipefail

apk=$1 out=$2 channel=$3
settle=${SMOKE_SETTLE_SECONDS:-30}
if [ -d "$apk" ]; then
  apk=$(find "$apk" -maxdepth 1 -name '*.apk' | head -n 1)
fi
[ -f "$apk" ] || { echo "smoke.sh: no APK at '$1'" >&2; exit 2; }
mkdir -p "$out"

failures=()
rows=()
fail() { failures+=("$1"); echo "::error title=Emulator smoke ($channel)::$1"; }
row() { rows+=("| $1 | $2 |"); }
log() { echo "[smoke] $*"; }

# Package and launcher activity from the APK itself.
badging() {
  local dir tool
  for dir in $(ls -d "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"/build-tools/*/ 2>/dev/null | sort -rV); do
    for tool in aapt aapt2; do
      if [ -x "$dir$tool" ] && "$dir$tool" dump badging "$apk" 2>/dev/null; then return 0; fi
    done
  done
  return 1
}
badge=$(badging) || { echo "smoke.sh: no aapt/aapt2 under \$ANDROID_HOME/build-tools" >&2; exit 2; }
pkg=$(sed -n "s/^package: name='\([^']*\)'.*/\1/p" <<<"$badge")
activity=$(sed -n "s/^launchable-activity: name='\([^']*\)'.*/\1/p" <<<"$badge" | head -n 1)
[ -n "$pkg" ] && [ -n "$activity" ] || { echo "smoke.sh: no package/launchable activity in $apk" >&2; exit 2; }

app_pid() {
  local pid
  pid=$(adb shell pidof "$pkg" 2>/dev/null | tr -d '\r' | awk '{ print $1 }' || true)
  [ -n "$pid" ] || pid=$(adb shell ps -A 2>/dev/null | tr -d '\r' | awk -v p="$pkg" '$NF == p { print $2; exit }' || true)
  [ -n "$pid" ] || pid=$(adb shell ps 2>/dev/null | tr -d '\r' | awk -v p="$pkg" '$NF == p { print $2; exit }' || true)
  echo "$pid"
}

launch_ms=""
launch() { # label
  local file="$out/am-start-$1.txt"
  adb shell am start -W -n "$pkg/$activity" 2>&1 | tr -d '\r' >"$file" || true
  if grep -q '^Error' "$file"; then fail "am start ($1): $(grep -m 1 '^Error' "$file")"; fi
  launch_ms=$(sed -n 's/^TotalTime: *\([0-9][0-9]*\).*/\1/p' "$file" | head -n 1)
}

resumed() { # label row-title; a system dialog over the app is a window, not
  # an activity, so the resumed activity stays ours unless the app went away.
  local lines
  lines=$(adb shell dumpsys activity activities 2>/dev/null | tr -d '\r' | grep -E 'mResumedActivity|topResumedActivity|ResumedActivity:' || true)
  printf '== %s\n%s\n' "$1" "$lines" >>"$out/resumed-activity.txt"
  if [ -z "$lines" ]; then
    log "no resumed-activity line in dumpsys after $1; not checked"
    row "$2" "not visible in dumpsys"
  elif grep -qF "$pkg/" <<<"$lines"; then
    row "$2" ok
  else
    fail "$pkg is not the resumed activity after $1: $(head -n 1 <<<"$lines" | xargs)"
    row "$2" "**FAIL**"
  fi
}

finish() {
  {
    echo "### Emulator smoke: \`$channel\` on Android ${release:-?} (API ${sdk:-?}, ${abi:-?})"
    echo ""
    echo "\`$(basename "$apk")\` as \`$pkg/$activity\`"
    echo ""
    echo "| Check | Result |"
    echo "| --- | --- |"
    printf '%s\n' "${rows[@]}"
    echo ""
    if [ "${#failures[@]}" -gt 0 ]; then
      echo "**Failed:**"
      printf -- '- %s\n' "${failures[@]}"
      echo ""
    fi
  } >>"${GITHUB_STEP_SUMMARY:-/dev/stdout}"
  if [ "${#failures[@]}" -gt 0 ]; then exit 1; fi
  exit 0
}

adb wait-for-device
# The action waits for boot; give the package manager a moment as well.
for _ in $(seq 1 60); do
  adb shell pm path android >/dev/null 2>&1 && break
  sleep 2
done
sdk=$(adb shell getprop ro.build.version.sdk | tr -d '\r')
release=$(adb shell getprop ro.build.version.release | tr -d '\r')
abi=$(adb shell getprop ro.product.cpu.abi | tr -d '\r')
log "device: Android $release (API $sdk, $abi); app $pkg/$activity"

adb logcat -G 16M >/dev/null 2>&1 || true
adb shell settings put global package_verifier_enable 0 >/dev/null 2>&1 || true
adb shell settings put global verifier_verify_adb_installs 0 >/dev/null 2>&1 || true
adb shell svc power stayon true >/dev/null 2>&1 || true
adb shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1 || true
adb shell wm dismiss-keyguard >/dev/null 2>&1 || adb shell input keyevent 82 >/dev/null 2>&1 || true

# -g grants the runtime permissions up front (POST_NOTIFICATIONS on 13+), so
# no permission dialog covers the app in the screenshots.
installed=no
for attempt in 1 2 3; do
  if adb install -r -g "$apk" >"$out/install.txt" 2>&1; then
    installed=yes
    break
  fi
  log "install attempt $attempt failed: $(tail -n 1 "$out/install.txt")"
  sleep 10
done
if [ "$installed" != yes ]; then
  fail "adb install failed: $(tail -n 1 "$out/install.txt")"
  row install "**FAIL**"
  finish
fi
row install ok
adb logcat -b all -c >/dev/null 2>&1 || adb logcat -c >/dev/null 2>&1 || true

# Cold start, then let the JS bundle load and the first effects run (the
# engine start attempt, the update check).
launch cold
row "cold start (am start -W)" "${launch_ms:-?} ms"
sleep "$settle"
pid=$(app_pid)
if [ -n "$pid" ]; then row "alive ${settle}s after cold start" "ok (pid $pid)"; else
  fail "process $pkg not running ${settle}s after a cold start"
  row "alive ${settle}s after cold start" "**FAIL**"
fi
adb exec-out screencap -p >"$out/01-cold-start.png" || true
resumed 'cold start' "resumed after cold start"

# Background and resume (AppState transitions re-run the engine check).
adb shell input keyevent KEYCODE_HOME >/dev/null 2>&1 || true
sleep 5
launch warm
sleep 10
pid2=$(app_pid)
if [ -n "$pid2" ]; then row "alive after home and back" "ok (pid $pid2, ${launch_ms:-?} ms)"; else
  fail "process $pkg not running after home and back"
  row "alive after home and back" "**FAIL**"
fi
if [ -n "$pid" ] && [ -n "$pid2" ] && [ "$pid" != "$pid2" ]; then
  echo "::warning title=Emulator smoke ($channel)::process restarted while in the background (pid $pid -> $pid2)"
fi
adb exec-out screencap -p >"$out/02-resumed.png" || true
resumed 'home and back' "resumed after home and back"

# Channel wiring as the OS sees it: only full registers the accessibility service.
adb shell dumpsys package "$pkg" 2>/dev/null | tr -d '\r' >"$out/dumpsys-package.txt" || true
if grep -q 'PhoneCanDoAccessibilityService' "$out/dumpsys-package.txt"; then a11y=registered; else a11y=absent; fi
if { [ "$channel" = full ] && [ "$a11y" = absent ]; } || { [ "$channel" != full ] && [ "$a11y" = registered ]; }; then
  fail "accessibility service $a11y for $channel"
  row "accessibility service" "**FAIL** ($a11y)"
else
  row "accessibility service" "ok ($a11y)"
fi

# Logs and the crash scan.
adb shell dumpsys meminfo "$pkg" 2>/dev/null | tr -d '\r' >"$out/meminfo.txt" || true
adb logcat -d -v threadtime >"$out/logcat.txt" 2>/dev/null || true
adb logcat -d -b crash -v threadtime >"$out/logcat-crash.txt" 2>/dev/null || true
for p in $(printf '%s\n' "$pid" "$pid2" | sort -u); do
  adb logcat -d -v threadtime --pid="$p" >>"$out/logcat-app.txt" 2>/dev/null || true
done

fatal=$(grep -A 2 'FATAL EXCEPTION' "$out/logcat.txt" | grep -cF "Process: $pkg," || true)
native=$(grep -cF ">>> $pkg <<<" "$out/logcat.txt" || true)
anr=$(grep -cF "ANR in $pkg" "$out/logcat.txt" || true)
crashbuf=$(grep -cF "$pkg" "$out/logcat-crash.txt" || true)
jserr=$(grep -cE ' E ReactNativeJS' "$out/logcat.txt" || true)
engine=$(grep -cF 'serve start failed' "$out/logcat.txt" || true)
[ "${fatal:-0}" -eq 0 ] || fail "FATAL EXCEPTION in $pkg ($fatal)"
[ "${native:-0}" -eq 0 ] || fail "native crash (tombstone) for $pkg ($native)"
[ "${anr:-0}" -eq 0 ] || fail "ANR in $pkg ($anr)"
[ "${crashbuf:-0}" -eq 0 ] || fail "crash buffer mentions $pkg ($crashbuf lines)"
row "Java crash (FATAL EXCEPTION)" "$([ "${fatal:-0}" -eq 0 ] && echo none || echo "**$fatal**")"
row "native crash (tombstone)" "$([ "${native:-0}" -eq 0 ] && echo none || echo "**$native**")"
row "ANR" "$([ "${anr:-0}" -eq 0 ] && echo none || echo "**$anr**")"
row "crash buffer" "$([ "${crashbuf:-0}" -eq 0 ] && echo empty || echo "**$crashbuf lines**")"
row "ReactNativeJS errors (not gated)" "${jserr:-0}"
row "engine (absent by design, not gated)" "\"serve start failed\" x${engine:-0}"
if [ "${fatal:-0}" -gt 0 ]; then grep -A 30 'FATAL EXCEPTION' "$out/logcat.txt" | head -n 60 || true; fi

finish
