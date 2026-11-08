/*
 * The launcher standing in for the command (standin.h): fork proot, wait for
 * its report, pass signals on, end as the command did. Linux only
 * (signalfd), like everything the launcher runs on.
 */
#define _GNU_SOURCE

#include "standin.h"

#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <signal.h>
#include <stdio.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/resource.h>
#include <sys/signalfd.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <termios.h>
#include <unistd.h>

#include "die.h"
#include "relay.h"

/* proot's report on --status-fd: the command's pid, then its waitpid() status. */
#define REPORT_BYTES (2 * sizeof(int))

static sigset_t caught_set, old_mask;

/* fd when it is above stderr, else a close-on-exec copy that is (fd closed). */
static int above_stdio(int fd) {
  if (fd > STDERR_FILENO) return fd;
  int moved = fcntl(fd, F_DUPFD_CLOEXEC, STDERR_FILENO + 1);
  if (moved < 0) lc_die("cannot create the status pipe: %s", strerror(errno));
  close(fd);
  return moved;
}

/*
 * Whether the command takes the terminal on stdin for a session of its own
 * (proot's --setsid), the way a shell leads its session on a PC: then the
 * hangup when the terminal closes reaches the shell itself, which hangs up
 * its jobs. Only a session leader hands a terminal on. The terminal tab
 * starts us leading a session that holds no terminal (tcgetpgrp() fails
 * with ENOTTY): the command takes it as it is. A session that holds it
 * lets it go first (TIOCNOTTY). Android lets apps do neither that nor
 * tcgetsid() (TIOCGSID), hence the calls used here. Letting go hangs up
 * our own foreground group, that is us: SIGHUP is ignored meanwhile, before
 * it is ever blocked (a blocked signal would be kept for later even while
 * ignored).
 */
static int hand_over_terminal(void) {
  struct sigaction ignore, old;
  if (!isatty(STDIN_FILENO) || getsid(0) != getpid()) return 0;
  if (tcgetpgrp(STDIN_FILENO) < 0) return errno == ENOTTY;
  memset(&ignore, 0, sizeof ignore);
  ignore.sa_handler = SIG_IGN;
  if (sigaction(SIGHUP, &ignore, &old)) return 0;
  int done = ioctl(STDIN_FILENO, TIOCNOTTY) == 0;
  sigaction(SIGHUP, &old, NULL);
  return done;
}

void lc_standin_open(struct lc_standin *s) {
  int fds[2];
  int terminal = hand_over_terminal();
  if (pipe2(fds, O_CLOEXEC)) lc_die("cannot create the status pipe: %s", strerror(errno));
  s->read_fd = above_stdio(fds[0]);
  s->write_fd = above_stdio(fds[1]);
  snprintf(s->status_arg, sizeof s->status_arg, "--status-fd=%d", s->write_fd);
  s->nargs = 0;
  s->args[s->nargs++] = s->status_arg;
  if (terminal) s->args[s->nargs++] = "--setsid";

  /* Blocked from before the fork, so none is lost or kills us meanwhile. */
  sigemptyset(&caught_set);
  for (const int *sig = lc_caught; *sig; sig++) sigaddset(&caught_set, *sig);
  if (sigprocmask(SIG_BLOCK, &caught_set, &old_mask)) lc_die("cannot block signals: %s", strerror(errno));
  s->signal_fd = signalfd(-1, &caught_set, SFD_CLOEXEC);
  if (s->signal_fd < 0) lc_die("cannot watch signals: %s", strerror(errno));
}

/* The child: proot with the write end kept open across exec and our signal mask undone. */
static _Noreturn void exec_proot(const struct lc_standin *s, const char *const *args,
                                 const char *const *env) {
  close(s->read_fd);
  close(s->signal_fd);
  if (!fcntl(s->write_fd, F_SETFD, 0) && !sigprocmask(SIG_SETMASK, &old_mask, NULL)) {
    execve(args[0], (char *const *)args, (char *const *)env);
  }
  lc_die("cannot run %s: %s", args[0], strerror(errno));
}

/* Ends this process the way status says the command (or proot) ended. */
static _Noreturn void end_as(int status) {
  struct lc_end end = lc_end_of(status);
  if (end.signal) {
    /* Die by it like the command did, without writing a core of our own. */
    struct rlimit no_core = {0, 0};
    sigset_t one;
    setrlimit(RLIMIT_CORE, &no_core);
    signal(end.signal, SIG_DFL);
    sigemptyset(&one);
    sigaddset(&one, end.signal);
    sigprocmask(SIG_UNBLOCK, &one, NULL);
    raise(end.signal);
  }
  _exit(end.code);
}

/* proot ended without reporting the command's end (it failed to start, or died). */
static _Noreturn void end_as_proot(pid_t proot) {
  int status;
  while (waitpid(proot, &status, 0) < 0) {
    if (errno != EINTR) lc_die("cannot wait for proot: %s", strerror(errno));
  }
  end_as(status);
}

/* A signal's bit in the pending mask; every caught signal is below 32. */
static unsigned bit(int sig) { return 1u << (unsigned)sig; }

/*
 * One caught signal from the signalfd: passed on to command right away, or,
 * while its pid is unknown (0), returned as a bit to pass on later. A
 * command of -1 gets nothing (proot reported no usable pid).
 */
static unsigned take_signal(int signal_fd, pid_t command) {
  struct signalfd_siginfo info;
  if (read(signal_fd, &info, sizeof info) != (ssize_t)sizeof info) return 0;
  int sig = (int)info.ssi_signo;
  pid_t sender = (pid_t)info.ssi_pid;
  pid_t sender_pgrp = sender > 0 ? getpgid(sender) : 0;
  /* Until proot reports it, the command is starting in our own group. */
  pid_t command_pgrp = command ? getpgid(command) : getpgrp();
  if (!lc_relays(sig, info.ssi_code, sender > 0 && sender == getppid(), sender_pgrp > 0 ? sender_pgrp : 0,
                 command_pgrp > 0 ? command_pgrp : 0)) {
    return 0;
  }
  if (!command) return bit(sig);
  if (command > 0) kill(command, sig);
  return 0;
}

static _Noreturn void wait_for_command(const struct lc_standin *s, pid_t proot) {
  unsigned char report[REPORT_BYTES];
  size_t have = 0;
  pid_t command = 0;
  unsigned pending = 0;
  struct pollfd fds[2] = {{s->read_fd, POLLIN, 0}, {s->signal_fd, POLLIN, 0}};

  for (;;) {
    if (poll(fds, 2, -1) < 0) {
      if (errno == EINTR) continue;
      lc_die("cannot wait for the command: %s", strerror(errno));
    }
    if (fds[1].revents & POLLIN) pending |= take_signal(s->signal_fd, command);
    if (!(fds[0].revents & (POLLIN | POLLHUP | POLLERR))) continue;

    ssize_t n = read(s->read_fd, report + have, sizeof report - have);
    if (n < 0 && errno == EINTR) continue;
    if (n <= 0) end_as_proot(proot);
    have += (size_t)n;
    if (!command && have >= sizeof(int)) {
      int pid;
      memcpy(&pid, report, sizeof pid);
      /* Never 0 or below: kill() would take that for a whole group, or everyone. */
      command = pid > 0 ? (pid_t)pid : -1;
      for (const int *sig = lc_caught; *sig && command > 0; sig++) {
        if (pending & bit(*sig)) kill(command, *sig);
      }
      pending = 0;
    }
    if (have == sizeof report) {
      int status;
      memcpy(&status, report + sizeof(int), sizeof status);
      end_as(status);
    }
  }
}

_Noreturn void lc_standin_run(struct lc_standin *s, const char *const *args, const char *const *env) {
  pid_t proot = fork();
  if (proot < 0) lc_die("cannot start %s: %s", args[0], strerror(errno));
  if (proot == 0) exec_proot(s, args, env);
  close(s->write_fd);
  wait_for_command(s, proot);
}
