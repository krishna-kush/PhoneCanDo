#!/usr/bin/env bash
# Runs the PCE device harnesses on a booted emulator, exactly as
# pce/docs/modules/{android,ime,shizuku}.md describe: install the androidTest
# APK, enable the test accessibility service / IME through `settings` and
# `ime`, launch the scenario activity with `--ez run true`, then wait for the
# harness's own PASS/FAIL line in logcat. These are activity-driven harnesses,
# not instrumentation: `am instrument` force-stops the target package and kills
# the service under test, so connectedAndroidTest cannot run them.
#
# Usage (repo root, APKs already built): device-harness.sh <out-dir> [harness...]
# Writes <harness>.log, <harness>.png (pixels) and a step summary; exits 1 if
# any harness did not PASS.
set -uo pipefail

out=${1:?usage: device-harness.sh <out-dir> [android|ime|shizuku...]}
shift
harnesses=("$@")
[[ ${#harnesses[@]} -gt 0 ]] || harnesses=(android ime shizuku)
mkdir -p "$out"

sdk=$(adb shell getprop ro.build.version.sdk | tr -d '\r')
release=$(adb shell getprop ro.build.version.release | tr -d '\r')
echo "device: Android $release (API $sdk)"

# Polls logcat for the harness verdict; prints PASS, FAIL or TIMEOUT.
verdict() {
  local tag=$1 seconds=$2 line
  local deadline=$((SECONDS + seconds))
  while ((SECONDS < deadline)); do
    line=$(adb logcat -d -v brief -s "$tag" 2>/dev/null | grep -E ': (PASS|FAIL)' | tail -n 1)
    case "$line" in
      *': PASS'*) echo PASS && return ;;
      *': FAIL'*) echo FAIL && return ;;
    esac
    sleep 2
  done
  echo TIMEOUT
}

# Common tail: logs and pixels. Args: harness tag
collect() {
  local name=$1 tag=$2
  adb logcat -d -v threadtime -s "$tag" >"$out/$name.log" 2>&1
  adb exec-out screencap -p >"$out/$name.png" 2>/dev/null || rm -f "$out/$name.png"
}

# Uninstall only after the settings are restored (the docs' order): Android
# drops an uninstalled service/IME from the secure settings asynchronously,
# and that late write can land on top of the restore and wipe it.
remove() {
  adb uninstall "$1" >/dev/null 2>&1 || true
}

run_android() {
  local pkg=com.phonecando.pce.android.test
  local act=$pkg/com.phonecando.pce.android.TestActivity
  local svc=$pkg/com.phonecando.pce.android.TestAccessibilityService
  adb install -r -t pce/android/build/outputs/apk/androidTest/debug/android-debug-androidTest.apk || return 1
  adb shell am start -W -n "$act" >/dev/null # launch once to unstop the package
  local orig_services orig_enabled
  orig_services=$(adb shell settings get secure enabled_accessibility_services | tr -d '\r')
  orig_enabled=$(adb shell settings get secure accessibility_enabled | tr -d '\r')
  adb shell settings put secure enabled_accessibility_services "$svc"
  adb shell settings put secure accessibility_enabled 1
  sleep 5 # the docs' bind wait; the activity itself waits 10 s more for the service
  adb shell dumpsys accessibility | grep -E 'Bound services|TestAccessibility' >"$out/android-dumpsys.txt" || true
  # The unstop launch above left the activity on screen before the service
  # bound. Relaunching it over itself does not reliably send the window-state
  # event the harness reads its activity name from (seen flaky on API 34 and
  # 36 emulators); from the launcher it is a normal transition that always does.
  adb shell input keyevent KEYCODE_HOME
  sleep 1
  adb logcat -c
  adb shell am start -W -n "$act" --ez run true -f 0x10008000 >/dev/null
  result=$(verdict A11yDeviceTest 120)
  collect android A11yDeviceTest
  # Restore, as the doc's cleanup does (null means the key was unset).
  if [[ "$orig_services" == null ]]; then
    adb shell settings delete secure enabled_accessibility_services >/dev/null
  else
    adb shell settings put secure enabled_accessibility_services "$orig_services"
  fi
  adb shell settings put secure accessibility_enabled "${orig_enabled/null/0}"
  remove "$pkg"
  return 0
}

run_ime() {
  local pkg=com.phonecando.pce.ime.test
  local act=$pkg/com.phonecando.pce.ime.TestActivity
  local ime=$pkg/com.phonecando.pce.ime.TestImeService
  adb install -r -t pce/ime/build/outputs/apk/androidTest/debug/ime-debug-androidTest.apk || return 1
  adb shell am start -W -n "$act" >/dev/null
  local orig_ime
  orig_ime=$(adb shell settings get secure default_input_method | tr -d '\r')
  # The input method service registers the new IME asynchronously after the
  # install; enabling it before then fails with "Unknown input method".
  for _ in $(seq 1 30); do
    adb shell ime list -a -s | tr -d '\r' | grep -qxF "$ime" && break
    sleep 1
  done
  adb shell ime enable "$ime"
  adb shell ime set "$ime"
  sleep 2
  adb logcat -c
  adb shell am start -W -n "$act" --ez run true -f 0x10008000 >/dev/null
  result=$(verdict ImeDeviceTest 90)
  collect ime ImeDeviceTest
  if [[ "$orig_ime" == null || -z "$orig_ime" ]]; then adb shell ime reset; else adb shell ime set "$orig_ime"; fi
  remove "$pkg"
  return 0
}

run_shizuku() {
  local pkg=com.phonecando.pce.shizuku.test
  local act=$pkg/com.phonecando.pce.shizuku.TestActivity
  adb install -r -t pce/shizuku/build/outputs/apk/androidTest/debug/shizuku-debug-androidTest.apk || return 1
  adb logcat -c
  adb shell am start -W -n "$act" --ez run true -f 0x10008000 >/dev/null
  # No Shizuku on the emulator: the expected verdict is
  # "PASS unavailable/contract/fake-input" (docs/modules/shizuku.md).
  result=$(verdict ShizukuDeviceTest 60)
  collect shizuku ShizukuDeviceTest
  remove "$pkg"
  return 0
}

declare -A tags=([android]=A11yDeviceTest [ime]=ImeDeviceTest [shizuku]=ShizukuDeviceTest)
status=0
rows=()
for h in "${harnesses[@]}"; do
  echo "::group::$h harness (API $sdk)"
  result=ERROR
  "run_$h" || result=ERROR
  # The verdict line, plus the first exception line when the harness failed.
  line=$(grep -E ': (PASS|FAIL)' "$out/$h.log" 2>/dev/null | tail -n 1 | sed -E 's/^.*: ((PASS|FAIL).*)$/\1/')
  if [[ "$result" != PASS ]]; then
    cause=$(grep -m 1 -E '(Error|Exception)(:|$)' "$out/$h.log" 2>/dev/null | sed -E 's/^.*: ([A-Za-z.]*(Error|Exception).*)$/\1/')
    line="${line:-no verdict line} ${cause:-}"
    status=1
    echo "::error title=PCE $h harness (API $sdk)::$result: $line (see $h.log)"
    tail -n 40 "$out/$h.log" 2>/dev/null
  fi
  echo "$h: $result $line"
  rows+=("| $h | ${tags[$h]} | $result | \`${line:-—}\` |")
  echo "::endgroup::"
done

{
  echo "### PCE device harnesses: Android $release (API $sdk)"
  echo
  echo "| Harness | Log tag | Result | Verdict line |"
  echo "|---|---|---|---|"
  printf '%s\n' "${rows[@]}"
  echo
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"

exit "$status"
