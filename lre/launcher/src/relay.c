/* Signals the launcher passes on, and how it ends (rules: relay.h). Pure. */
#define _POSIX_C_SOURCE 200809L

#include "relay.h"

#include <signal.h>
#include <sys/wait.h>

#ifndef SI_KERNEL
#define SI_KERNEL 0x80
#endif

const int lc_caught[] = {SIGHUP, SIGINT, SIGQUIT, SIGTERM, SIGUSR1, SIGUSR2, 0};

static int caught(int sig) {
  for (const int *s = lc_caught; *s; s++) {
    if (*s == sig) return 1;
  }
  return 0;
}

int lc_relays(int sig, int code, int from_parent, pid_t sender_pgrp, pid_t command_pgrp) {
  if (!caught(sig)) return 0;
  if (code == SI_KERNEL) return sig == SIGHUP;
  if (from_parent) return 1;
  return !(sender_pgrp > 0 && sender_pgrp == command_pgrp);
}

struct lc_end lc_end_of(int status) {
  struct lc_end end = {127, 0};
  if (WIFEXITED(status)) {
    end.code = WEXITSTATUS(status);
  } else if (WIFSIGNALED(status)) {
    end.signal = WTERMSIG(status);
    end.code = 128 + end.signal;
  }
  return end;
}
