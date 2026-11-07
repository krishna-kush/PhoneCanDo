# shellcheck shell=sh
# PhoneCanDo: C.UTF-8 (built into glibc) when nothing set a locale.
if [ -z "${LANG-}" ]; then
  LANG=C.UTF-8
  export LANG
fi
