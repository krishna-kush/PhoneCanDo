/*
 * How the launcher stands in for the command it runs (standin.c): which
 * signals it passes on to the command, and how it ends once the command
 * has. Pure: no IO, no allocation.
 */
#ifndef PHONECANDO_LAUNCH_RELAY_H
#define PHONECANDO_LAUNCH_RELAY_H

#include <sys/types.h>

/*
 * The signals the launcher catches instead of dying from them, so it ends
 * only as the command did: SIGHUP, SIGINT, SIGQUIT, SIGTERM, SIGUSR1 and
 * SIGUSR2. 0-terminated.
 */
extern const int lc_caught[];

/*
 * Whether sig, caught by the launcher, goes on to the command. code is the
 * siginfo si_code; from_parent says the sender is the launcher's parent
 * (its caller); sender_pgrp is the sender's process group and command_pgrp
 * the command's (0 when unknown). Not passed on:
 *   - what the kernel sends for the terminal (Ctrl-C, Ctrl-\): it reaches
 *     the terminal's foreground group, so the command when it is there, by
 *     itself. The hangup SIGHUP goes to the session leader alone, so it is
 *     passed on;
 *   - what another process of the command's own group sends (`kill 0` in
 *     the command): the command got it already.
 * Everything else is, the caller's signals always: one for the launcher's
 * pid alone (Java's destroy, a reaper) must reach the command. One for the
 * launcher's whole group (a timeout's kill) then reaches the command twice,
 * as under coreutils' timeout.
 */
int lc_relays(int sig, int code, int from_parent, pid_t sender_pgrp, pid_t command_pgrp);

/* How the launcher ends: exit(code) when signal is 0, else die by signal. */
struct lc_end {
  int code;
  int signal;
};

/*
 * The launcher's end for a waitpid() status: the same exit code, or death by
 * the same signal (code 128 + signal in case raising it fails). Anything
 * else (a stop, never reported) ends with 127.
 */
struct lc_end lc_end_of(int status);

#endif
