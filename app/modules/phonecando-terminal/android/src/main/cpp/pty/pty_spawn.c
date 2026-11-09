// Starts a program on a fresh pseudo-terminal. We fork from a multithreaded
// app, where another thread may hold the malloc, JNI or stdio locks at the
// moment of fork, so everything that allocates or can fail is done here in
// the parent first. The child (run_child) makes async-signal-safe calls only.
#define _GNU_SOURCE
#include "pty.h"
#include "pty_path.h"

#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <signal.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/resource.h>
#include <sys/syscall.h>
#include <termios.h>
#include <unistd.h>
#ifdef __ANDROID__
#include <android/api-level.h>
#endif

#ifndef SYS_close_range
#define SYS_close_range 436  // the same number on every Linux architecture
#endif

// Bound for the close loop when close_range can't be used. Android apps run
// with a soft RLIMIT_NOFILE of 32768.
#define FD_LOOP_MAX 65536

// What the child writes to the error pipe when it can't reach execve. A
// successful execve closes the pipe instead (close-on-exec), so the parent
// reads either this or end-of-file.
typedef struct {
  int stage;
  int err;
} child_report;

// Everything the child needs, prepared before fork.
typedef struct {
  const char *path;
  char *const *argv;
  char *const *envp;
  const char *cwd;  // NULL keeps ours
  int slave;
  int report;  // error pipe write end, close-on-exec
  int fd_limit;
  int use_close_range;
  int hand_over;  // leave the slave no session's controlling terminal
} child_plan;

__attribute__((noreturn)) static void child_fail(int report, int stage, int err) {
  child_report r = {stage, err};
  while (write(report, &r, sizeof r) < 0 && errno == EINTR) {
  }
  _exit(127);
}

static void close_from(int first, const child_plan *p) {
  if (p->use_close_range && syscall(SYS_close_range, (unsigned)first, ~0U, 0) == 0) return;
  for (int fd = first; fd < p->fd_limit; fd++) close(fd);
}

// The child, between fork and execve: async-signal-safe calls only.
__attribute__((noreturn)) static void run_child(const child_plan *p) {
  // Signal state is inherited and partly survives execve: ignored signals
  // stay ignored and the mask stays as it is. We forked with everything
  // blocked, so reset dispositions first (no app handler can run in here),
  // then unblock. Signals libc reserves for itself refuse the reset; execve
  // drops their handlers anyway. SIGSEGV is reset only when ignored: ART's
  // libsigchain owns its handler and logs a stack trace as an error for
  // every reset to SIG_DFL, and execve drops a caught handler by itself.
  struct sigaction dfl;
  memset(&dfl, 0, sizeof dfl);
  dfl.sa_handler = SIG_DFL;
  for (int sig = 1; sig < NSIG; sig++) {
    if (sig == SIGKILL || sig == SIGSTOP) continue;
    if (sig == SIGSEGV) {
      struct sigaction cur;
      if (sigaction(sig, NULL, &cur) == 0 && cur.sa_handler != SIG_IGN) continue;
    }
    sigaction(sig, &dfl, NULL);
  }
  sigset_t none;
  sigemptyset(&none);
  sigprocmask(SIG_SETMASK, &none, NULL);

  // New session with the slave as stdio, and as controlling terminal unless
  // the program hands it on.
  if (setsid() < 0 || (!p->hand_over && ioctl(p->slave, TIOCSCTTY, 0) < 0)) {
    child_fail(p->report, PTY_STAGE_SESSION, errno);
  }
  for (int fd = 0; fd < 3; fd++) {
    if (dup2(p->slave, fd) < 0) child_fail(p->report, PTY_STAGE_SESSION, errno);
  }

  // Keep only stdio and the error pipe (moved to 3): any fd the app opened
  // without close-on-exec would otherwise leak into the program.
  int report = p->report;
  if (report != 3) {
    if (dup3(report, 3, O_CLOEXEC) < 0) child_fail(report, PTY_STAGE_SESSION, errno);
    report = 3;
  }
  close_from(4, p);

  if (p->cwd && chdir(p->cwd) < 0) child_fail(report, PTY_STAGE_CHDIR, errno);
  execve(p->path, p->argv, p->envp);
  child_fail(report, PTY_STAGE_EXEC, errno);
}

// Moves fd above stdio (keeping close-on-exec) so the child's dup2 onto 0..2
// can't clobber it. Only matters if our own stdio was closed.
static int above_stdio(int fd) {
  if (fd > 2) return fd;
  int moved = fcntl(fd, F_DUPFD_CLOEXEC, 3);
  int err = errno;
  close(fd);
  errno = err;
  return moved;
}

// Opens the master/slave pair at rows x cols; the slave raw unless [cooked].
static int open_pair(unsigned short rows, unsigned short cols, int cooked, int *master_out,
                     int *slave_out) {
  // Non-blocking master: reads must return at once so the JS thread (Expo
  // Functions are sync JSI) never stalls waiting for TUI output. Missing
  // this = soft keyboard up, onChangeText starved, typing dead.
  int master = posix_openpt(O_RDWR | O_NOCTTY | O_CLOEXEC | O_NONBLOCK);
  if (master < 0) return errno;
  int slave = -1;
  int err;
  char name[64];
  if (grantpt(master) != 0 || unlockpt(master) != 0) goto fail_errno;
  if ((err = ptsname_r(master, name, sizeof name)) != 0) goto fail;
  if ((slave = open(name, O_RDWR | O_NOCTTY | O_CLOEXEC)) < 0) goto fail_errno;

  // Raw mode, so a TUI gets keystrokes uncooked and its output untouched. A
  // shell keeps the tty's defaults: its line editor sets its own modes, and
  // echoes what you type only when the tty echoed to begin with.
  if (!cooked) {
    struct termios t;
    if (tcgetattr(slave, &t) != 0) goto fail_errno;
    cfmakeraw(&t);
    if (tcsetattr(slave, TCSANOW, &t) != 0) goto fail_errno;
  }
  struct winsize ws;
  memset(&ws, 0, sizeof ws);
  ws.ws_row = rows;
  ws.ws_col = cols;
  if (ioctl(master, TIOCSWINSZ, &ws) != 0) goto fail_errno;
  if ((slave = above_stdio(slave)) < 0) goto fail_errno;

  *master_out = master;
  *slave_out = slave;
  return 0;

fail_errno:
  err = errno;
fail:
  if (slave >= 0) close(slave);
  close(master);
  return err;
}

static int fd_limit(void) {
  struct rlimit rl;
  if (getrlimit(RLIMIT_NOFILE, &rl) != 0 || rl.rlim_cur == RLIM_INFINITY ||
      rl.rlim_cur > FD_LOOP_MAX) {
    return FD_LOOP_MAX;
  }
  return (int)rl.rlim_cur;
}

static int close_range_usable(void) {
#if defined(PTY_TEST_NO_CLOSE_RANGE)
  return 0;  // host test of the fallback loop
#elif defined(__ANDROID__)
  // The kernel has close_range from 5.9 (every Android 12+ GKI), but bionic
  // only wraps it from API 34, and app seccomp filters on older releases may
  // not list it: an unlisted syscall kills the child with SIGSYS. Kernels
  // without it answer ENOSYS and we fall back to the loop.
  return android_get_device_api_level() >= 34;
#else
  return 1;
#endif
}

int pty_spawn(const pty_spec *spec, pty_child *out, pty_stage *stage) {
  *stage = PTY_STAGE_LOOKUP;
  if (!spec || !spec->argv || !spec->argv[0] || !spec->envp) return EINVAL;
  char found[PATH_MAX];
  child_plan plan;
  memset(&plan, 0, sizeof plan);
  int err = pty_find_program(spec->argv[0], spec->envp, found, sizeof found, &plan.path);
  if (err) return err;
  plan.argv = spec->argv;
  plan.envp = spec->envp;
  plan.cwd = spec->cwd && spec->cwd[0] ? spec->cwd : NULL;
  plan.fd_limit = fd_limit();
  plan.use_close_range = close_range_usable();
  plan.hand_over = spec->hand_over;

  *stage = PTY_STAGE_OPEN;
  int master = -1;
  err = open_pair(spec->rows, spec->cols, spec->cooked, &master, &plan.slave);
  if (err) return err;
  int pipe_fds[2];
  if (pipe2(pipe_fds, O_CLOEXEC) != 0) {
    err = errno;
    goto fail_open;
  }
  if ((plan.report = above_stdio(pipe_fds[1])) < 0) {
    err = errno;
    close(pipe_fds[0]);
    goto fail_open;
  }

  // Fork with every signal blocked, so no app handler can run in the child
  // before run_child has reset them.
  sigset_t all, old;
  sigfillset(&all);
  pthread_sigmask(SIG_SETMASK, &all, &old);
  pid_t pid = fork();
  if (pid == 0) run_child(&plan);
  int fork_err = errno;
  pthread_sigmask(SIG_SETMASK, &old, NULL);
  close(plan.slave);
  close(plan.report);
  if (pid < 0) {
    close(pipe_fds[0]);
    close(master);
    *stage = PTY_STAGE_FORK;
    return fork_err;
  }

  // Wait until the child has exec'd (end-of-file) or tells us why not.
  child_report r;
  ssize_t n;
  do {
    n = read(pipe_fds[0], &r, sizeof r);
  } while (n < 0 && errno == EINTR);
  close(pipe_fds[0]);
  if (n == (ssize_t)sizeof r) {
    pty_exit ignored;
    pty_reap(pid, &ignored);  // it has _exit'ed or is about to
    close(master);
    *stage = (pty_stage)r.stage;
    return r.err;
  }
  out->master = master;
  out->pid = pid;
  return 0;

fail_open:
  close(plan.slave);
  close(master);
  return err;
}

const char *pty_stage_name(pty_stage stage) {
  switch (stage) {
    case PTY_STAGE_LOOKUP: return "lookup";
    case PTY_STAGE_OPEN: return "open";
    case PTY_STAGE_FORK: return "fork";
    case PTY_STAGE_SESSION: return "session";
    case PTY_STAGE_CHDIR: return "chdir";
    case PTY_STAGE_EXEC: return "exec";
  }
  return "spawn";
}
