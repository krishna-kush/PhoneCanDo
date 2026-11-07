// Child lifecycle: wait, reap and signal one PTY child by its own pid only.
// Java's ProcessBuilder children live in the same process, and its reaper
// waits on their specific pids; a waitpid(-1) here could take their status.
#include "pty.h"

#include <errno.h>
#include <signal.h>
#include <string.h>
#include <sys/wait.h>

int pty_await_exit(pid_t pid) {
  if (pid <= 0) return EINVAL;
  siginfo_t info;
  for (;;) {
    memset(&info, 0, sizeof info);
    if (waitid(P_PID, (id_t)pid, &info, WEXITED | WNOWAIT) == 0) return 0;
    if (errno != EINTR) return errno;
  }
}

int pty_reap(pid_t pid, pty_exit *out) {
  if (pid <= 0) return EINVAL;
  int status;
  pid_t r;
  do {
    r = waitpid(pid, &status, 0);
  } while (r < 0 && errno == EINTR);
  if (r < 0) return errno;
  out->code = WIFEXITED(status) ? WEXITSTATUS(status) : -1;
  out->signal = WIFSIGNALED(status) ? WTERMSIG(status) : 0;
  return 0;
}

int pty_kill(pid_t pid, int sig) {
  // pid 1 would make this kill(-1): every process we may signal.
  if (pid <= 1) return EINVAL;
  return kill(-pid, sig) == 0 ? 0 : errno;
}
