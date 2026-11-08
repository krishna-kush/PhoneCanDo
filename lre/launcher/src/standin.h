/*
 * The launcher's process stands in for the guest command: it starts proot
 * as its child with a status pipe (proot's --status-fd, our patch
 * lre/proot/patches/0002-status-fd.patch), learns the command's pid and
 * end from it, passes signals on (relay.h) and ends as the command ended.
 * proot stays behind, out of the caller's session and stdio, tracing what
 * the command left running. When the launcher leads the session of the
 * terminal on its stdin (the terminal tab's program), it hands that
 * terminal to the command (proot's --setsid), so the command is the
 * terminal's controlling process, as a login shell is on a PC. This is the
 * IO; relay.c holds the rules.
 */
#ifndef PHONECANDO_LAUNCH_STANDIN_H
#define PHONECANDO_LAUNCH_STANDIN_H

/* "--status-fd=" and an int. */
#define LC_STATUS_ARG_BYTES 32

struct lc_standin {
  int read_fd;  /* ours */
  int write_fd; /* proot's, named in status_arg */
  int signal_fd;
  char status_arg[LC_STATUS_ARG_BYTES];
  /* The proot options to add: status_arg, then --setsid with a terminal. */
  const char *args[2];
  int nargs;
};

/*
 * Hands over the terminal we lead, if any; the status pipe, both ends above
 * stderr; the caught signals (lc_caught) blocked and read through a
 * signalfd from here on. Any error ends the launcher (127).
 */
void lc_standin_open(struct lc_standin *s);

/*
 * Forks and execs args[0] (proot) with args and env in the child, then
 * waits, passing caught signals on, and ends as the command did. When proot
 * ends without reporting the command's end (it failed to start, or died),
 * ends as proot did. Never returns.
 */
_Noreturn void lc_standin_run(struct lc_standin *s, const char *const *args, const char *const *env);

#endif
