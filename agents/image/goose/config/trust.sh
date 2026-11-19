#!/bin/sh
# Seeded by PhoneCanDo into ~/.phonecando/goose and run by goose's launch,
# with the phone tools on, before goose starts: lets our phonecando
# extension's tools run without goose's approval prompt (approve and
# smart_approve modes), since the phone-control lock is their check. goose
# takes per-tool permissions only from permission.yaml in its config folder
# (crates/goose/src/config/permission.rs), by the tool's full name,
# phonecando__<tool>, with no wildcard, so each of our tools is named.
#
# A missing or empty file is written whole. An existing one gets only our
# missing names under user.always_allow, and only in the plain block shape
# goose writes itself; any other line (a comment, a flow list with items,
# odd indents) leaves it untouched, and so does a link. goose refuses to
# start on a permission.yaml it can't read, so nothing else is risked.
# POSIX sh only: the image may have no awk, node or python.

if [ -n "${GOOSE_PATH_ROOT:-}" ]; then pd="$GOOSE_PATH_ROOT/config"; else pd="$HOME/.config/goose"; fi
pf="$pd/permission.yaml"
pt="phone_ping phone_battery phone_notify phone_focus phone_share phone_open
phone_clipboard agents_list agents_send agents_status agents_inbox agents_wait
agents_keep_running schedule_add schedule_list schedule_cancel phone_describe
phone_observe phone_act phone_pack phone_return phone_request_unlock
phone_open_accessibility phone_hand_over phone_wait_for_user"
nl='
'

ours() { # $1: names already in user.always_allow; $2: item indent
  for n in $pt; do
    case "$1" in *" phonecando__$n "*) ;; *) o="$o$2phonecando__$n$nl"; ad=1 ;; esac
  done
}

if [ -L "$pf" ]; then
  :
elif [ ! -e "$pf" ] || { [ -f "$pf" ] && [ ! -s "$pf" ]; }; then
  o="user:$nl  always_allow:$nl"
  ours ' ' '  - '
  o="$o  ask_before: []$nl  never_allow: []$nl"
  mkdir -p "$pd" && printf '%s' "$o" >"$pf.phonecando" && mv -f "$pf.phonecando" "$pf"
elif [ -f "$pf" ]; then
  # u: in the user section; a: in its always_allow list; hu, ga: seen them;
  # sn: the names that list holds; ad: something to add.
  o=; ok=1; u=0; a=0; hu=0; ga=0; ad=0; sn=' '; ind='  - '
  while IFS= read -r l || [ -n "$l" ]; do
    if [ "$a" = 1 ]; then
      case "$l" in
        '  - '*|'    - '*) sn="$sn${l#*- } "; ind="${l%%- *}- "; o="$o$l$nl"; continue ;;
      esac
      ours "$sn" "$ind"
      a=0
    fi
    case "$l" in
      '  '[a-z_]*': []')
        k="${l#  }"; k="${k%: \[\]}"
        case "$k" in *[!a-z_]*) ok=0 ;; esac
        if [ "$u" = 1 ] && [ "$k" = always_allow ]; then
          ga=1; o="$o  always_allow:$nl"; ours ' ' '  - '
        else
          o="$o$l$nl"
        fi ;;
      '  '[a-z_]*':')
        k="${l#  }"; k="${k%:}"
        case "$k" in *[!a-z_]*) ok=0 ;; esac
        if [ "$u" = 1 ] && [ "$k" = always_allow ]; then ga=1; a=1; fi
        o="$o$l$nl" ;;
      '  - '*|'    - '*)
        o="$o$l$nl" ;;
      [a-z_]*':')
        k="${l%:}"
        case "$k" in *[!a-z_]*) ok=0 ;; esac
        if [ "$k" = user ]; then u=1; hu=1; else u=0; fi
        o="$o$l$nl" ;;
      *)
        ok=0 ;;
    esac
  done <"$pf"
  if [ "$a" = 1 ]; then ours "$sn" "$ind"; fi
  if [ "$hu" = 0 ]; then
    o="${o}user:$nl  always_allow:$nl"
    ours ' ' '  - '
    o="$o  ask_before: []$nl  never_allow: []$nl"
  elif [ "$ga" = 0 ]; then
    ok=0
  fi
  if [ "$ok" = 1 ] && [ "$ad" = 1 ]; then
    printf '%s' "$o" >"$pf.phonecando" && mv -f "$pf.phonecando" "$pf"
  fi
fi
