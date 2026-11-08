// Host test of the pty core (src/main/cpp/pty/): real PTYs and real child
// processes on a Linux machine. Build and run with run.sh.
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <termios.h>
#include <unistd.h>

#include "harness.h"

#define T 5000  // ms we give a child to answer
#define BUF 8192

static char *const no_env[] = {NULL};
static char *const sys_path[] = {"PATH=/usr/bin:/bin", NULL};

// Spawns, runs to the end, and collects output and exit.
static int run(char *const argv[], char *const envp[], const char *cwd, char *out, pty_exit *ex) {
  pty_child c;
  pty_stage stage;
  pty_spec spec = {.argv = argv, .envp = envp, .cwd = cwd, .rows = 24, .cols = 80};
  int err = pty_spawn(&spec, &c, &stage);
  if (err) return err;
  read_until(c.master, out, BUF, NULL, T);
  close(c.master);
  return finish(c.pid, ex);
}

static int spawn_ok(char *const argv[], char *const envp[], unsigned short rows,
                    unsigned short cols, pty_child *c) {
  pty_stage stage;
  pty_spec spec = {.argv = argv, .envp = envp, .cwd = NULL, .rows = rows, .cols = cols};
  return pty_spawn(&spec, c, &stage);
}

static int test_output_round_trip(void) {
  char out[BUF];
  pty_exit ex;
  char *argv[] = {"/bin/sh", "-c", "printf hi", NULL};
  CHECK(run(argv, sys_path, NULL, out, &ex) == 0, "");
  CHECK(strcmp(out, "hi") == 0, "got '%s'", out);
  CHECK(ex.code == 0 && ex.signal == 0, "code %d signal %d", ex.code, ex.signal);
  return 0;
}

static int test_input_round_trip(void) {
  char *argv[] = {"/bin/sh", "-c", "read x; printf 'got:%s' \"$x\"", NULL};
  pty_child c;
  CHECK(spawn_ok(argv, sys_path, 24, 80, &c) == 0, "");
  CHECK(pty_write_all(c.master, "abc\n", 4) == 4, "");
  char out[BUF];
  read_until(c.master, out, BUF, NULL, T);
  CHECK(strcmp(out, "got:abc") == 0, "got '%s'", out);
  close(c.master);
  pty_exit ex;
  CHECK(finish(c.pid, &ex) == 0 && ex.code == 0, "");
  return 0;
}

static int test_exit_status(void) {
  char out[BUF];
  pty_exit ex;
  char *argv[] = {"/bin/sh", "-c", "exit 3", NULL};
  CHECK(run(argv, sys_path, NULL, out, &ex) == 0, "");
  CHECK(ex.code == 3 && ex.signal == 0, "code %d signal %d", ex.code, ex.signal);
  return 0;
}

static int test_master_and_tty_modes(void) {
  char *argv[] = {"/bin/sh", "-c", "stty size; stty -a; echo END; read x", NULL};
  pty_child c;
  CHECK(spawn_ok(argv, sys_path, 33, 99, &c) == 0, "");
  int fl = fcntl(c.master, F_GETFL);
  int fdfl = fcntl(c.master, F_GETFD);
  CHECK(fl >= 0 && (fl & O_NONBLOCK), "master must be non-blocking");
  CHECK(fdfl >= 0 && (fdfl & FD_CLOEXEC), "master must be close-on-exec");
  char out[BUF];
  read_until(c.master, out, BUF, "END\n", T);
  CHECK(strncmp(out, "33 99\n", 6) == 0, "size line '%.20s'", out);
  CHECK(strstr(out, "-icanon") && strstr(out, "-isig") && strstr(out, "-opost"),
        "slave not raw: %s", out);
  // Nothing more to read: the master answers at once instead of blocking.
  char b[16];
  CHECK(pty_read(c.master, b, sizeof b) == 0, "");
  CHECK(pty_write_all(c.master, "\n", 1) == 1, "");
  read_until(c.master, out, BUF, NULL, T);
  close(c.master);
  pty_exit ex;
  CHECK(finish(c.pid, &ex) == 0 && ex.code == 0, "code %d", ex.code);
  return 0;
}

// A shell's tty: cooked, so its line editor echoes and edits lines.
static int test_cooked_tty(void) {
  char *argv[] = {"/bin/sh", "-c", "stty -a; echo END", NULL};
  pty_stage stage;
  pty_spec spec = {.argv = argv, .envp = sys_path, .rows = 24, .cols = 80, .cooked = 1};
  pty_child c;
  CHECK(pty_spawn(&spec, &c, &stage) == 0, "");
  char out[BUF];
  // To the end of output, so the shell has exited before the close below
  // (closing first would hang it up and turn its exit into a signal).
  read_until(c.master, out, BUF, NULL, T);
  CHECK(strstr(out, "END"), "no END: %s", out);
  CHECK(!strstr(out, "-icanon") && !strstr(out, "-echo ") && !strstr(out, "-isig"),
        "slave not cooked: %s", out);
  close(c.master);
  pty_exit ex;
  CHECK(finish(c.pid, &ex) == 0 && ex.code == 0, "code %d", ex.code);
  return 0;
}

// The program's controlling terminal: the PTY, or none when it hands the
// PTY on (tty_nr in /proc/self/stat is 0 without one). Not a shell: bash
// leading a session takes the terminal on its stdin by itself.
static int check_ctty(int hand_over, const char *want) {
  char *argv[] = {"awk", "{ print ($7 == 0 ? \"free\" : \"held\") }", "/proc/self/stat", NULL};
  pty_stage stage;
  pty_spec spec = {.argv = argv, .envp = sys_path, .rows = 24, .cols = 80, .hand_over = hand_over};
  pty_child c;
  CHECK(pty_spawn(&spec, &c, &stage) == 0, "");
  char out[BUF];
  read_until(c.master, out, BUF, NULL, T);
  CHECK(strcmp(out, want) == 0, "hand_over %d: got '%s'", hand_over, out);
  close(c.master);
  pty_exit ex;
  CHECK(finish(c.pid, &ex) == 0 && ex.code == 0, "code %d", ex.code);
  return 0;
}

static int test_hand_over(void) {
  CHECK(check_ctty(0, "held\n") == 0, "");
  CHECK(check_ctty(1, "free\n") == 0, "");
  return 0;
}

static int test_env_is_exact(void) {
  setenv("PTY_TEST_LEAK", "parent-only", 1);
  char *envp[] = {"A=1", "B=two", NULL};
  char *argv[] = {"/usr/bin/env", NULL};
  char out[BUF];
  pty_exit ex;
  CHECK(run(argv, envp, NULL, out, &ex) == 0, "");
  CHECK(strcmp(out, "A=1\nB=two\n") == 0, "got '%s'", out);
  unsetenv("PTY_TEST_LEAK");
  return 0;
}

static int test_cwd(void) {
  char dir[PATH_MAX];
  CHECK(make_temp_dir(dir) == 0, "");
  char *argv[] = {"/bin/pwd", NULL};
  char out[BUF], want[PATH_MAX + 2];
  pty_exit ex;
  CHECK(run(argv, no_env, dir, out, &ex) == 0, "");
  snprintf(want, sizeof want, "%s\n", dir);
  CHECK(strcmp(out, want) == 0, "got '%s' want '%s'", out, want);
  rmdir(dir);

  // A missing cwd fails the spawn instead of running somewhere else.
  pty_child c;
  pty_stage stage;
  pty_spec spec = {.argv = argv, .envp = no_env, .cwd = "/nonexistent/pty-test", .rows = 24,
                   .cols = 80};
  CHECK(pty_spawn(&spec, &c, &stage) == ENOENT && stage == PTY_STAGE_CHDIR, "stage %d", stage);
  CHECK(no_children_left(), "failed spawn left a child");
  return 0;
}

static int test_fds_closed(void) {
  int fd = open("/dev/null", O_RDONLY);  // no O_CLOEXEC on purpose
  CHECK(fd >= 0, "");
  CHECK(dup2(fd, 50) == 50 && dup2(fd, 900) == 900, "");
  char *argv[] = {"/bin/ls", "-1", "/proc/self/fd", NULL};
  char out[BUF];
  pty_exit ex;
  int err = run(argv, no_env, NULL, out, &ex);
  close(fd);
  close(50);
  close(900);
  CHECK(err == 0 && ex.code == 0, "err %d code %d", err, ex.code);
  // ls sees 0-2 (the tty) and 3 (its own handle on /proc/self/fd) only.
  int count = 0;
  for (char *tok = strtok(out, " \r\n"); tok; tok = strtok(NULL, " \r\n")) {
    int n = atoi(tok);
    CHECK(n >= 0 && n <= 3, "child inherited fd %d", n);
    count++;
  }
  CHECK(count == 4, "saw %d fds", count);
  return 0;
}

static int all_zero(const char *status, const char *key) {
  const char *p = strstr(status, key);
  if (!p) return 0;
  p += strlen(key);
  while (*p == ' ' || *p == '\t') p++;
  int digits = 0;
  for (; *p && *p != '\n'; p++, digits++) {
    if (*p != '0') return 0;
  }
  return digits > 0;
}

static void on_usr2(int sig) { (void)sig; }

static int check_signal_state(void) {
  char out[BUF];
  pty_exit ex;
  char *cat[] = {"/bin/cat", "/proc/self/status", NULL};
  CHECK(run(cat, no_env, NULL, out, &ex) == 0, "");
  CHECK(all_zero(out, "SigBlk:"), "child has blocked signals");
  CHECK(all_zero(out, "SigIgn:"), "child has ignored signals");

  // And it behaves that way: signals we ignore or block still kill it.
  char *pipe_self[] = {"/bin/sh", "-c", "kill -PIPE $$; echo survived", NULL};
  CHECK(run(pipe_self, sys_path, NULL, out, &ex) == 0, "");
  CHECK(ex.signal == SIGPIPE && !strstr(out, "survived"), "signal %d out '%s'", ex.signal, out);
  char *usr1_self[] = {"/bin/sh", "-c", "kill -USR1 $$; echo survived", NULL};
  CHECK(run(usr1_self, sys_path, NULL, out, &ex) == 0, "");
  CHECK(ex.signal == SIGUSR1 && !strstr(out, "survived"), "signal %d out '%s'", ex.signal, out);
  return 0;
}

static int test_signals_reset(void) {
  // Dirty our own signal state the way an app might, then check none of it
  // reaches the child.
  struct sigaction ign, catcher, old_int, old_pipe, old_usr2;
  memset(&ign, 0, sizeof ign);
  ign.sa_handler = SIG_IGN;
  memset(&catcher, 0, sizeof catcher);
  catcher.sa_handler = on_usr2;
  sigaction(SIGINT, &ign, &old_int);
  sigaction(SIGPIPE, &ign, &old_pipe);
  sigaction(SIGUSR2, &catcher, &old_usr2);
  sigset_t block, old_mask;
  sigemptyset(&block);
  sigaddset(&block, SIGUSR1);
  sigaddset(&block, SIGTERM);
  sigprocmask(SIG_BLOCK, &block, &old_mask);

  int r = check_signal_state();

  sigprocmask(SIG_SETMASK, &old_mask, NULL);
  sigaction(SIGINT, &old_int, NULL);
  sigaction(SIGPIPE, &old_pipe, NULL);
  sigaction(SIGUSR2, &old_usr2, NULL);
  return r;
}

// 1 when pid is gone or a zombie waiting for its (new) parent.
static int process_gone(pid_t pid) {
  char path[64], stat[256];
  snprintf(path, sizeof path, "/proc/%d/stat", (int)pid);
  FILE *f = fopen(path, "r");
  if (!f) return 1;
  size_t n = fread(stat, 1, sizeof stat - 1, f);
  fclose(f);
  stat[n] = '\0';
  const char *close_paren = strrchr(stat, ')');
  return close_paren && close_paren[1] == ' ' && close_paren[2] == 'Z';
}

static int test_kill_group(void) {
  // The background member ignores SIGHUP, so the hangup that follows the
  // leader's death can't take it down: only a signal to the group can.
  char *argv[] = {"/bin/sh", "-c", "(trap '' HUP; exec sleep 30) & echo $!; wait", NULL};
  pty_child c;
  CHECK(spawn_ok(argv, sys_path, 24, 80, &c) == 0, "");
  char out[BUF];
  read_until(c.master, out, BUF, "\n", T);
  pid_t bg = (pid_t)atoi(out);
  CHECK(bg > 1, "no background pid in '%s'", out);

  CHECK(pty_kill(c.pid, SIGTERM) == 0, "");
  pty_exit ex;
  CHECK(finish(c.pid, &ex) == 0, "");
  CHECK(ex.signal == SIGTERM && ex.code == -1, "code %d signal %d", ex.code, ex.signal);
  // The background sleep shares the group, so it got SIGTERM too.
  int gone = 0;
  for (int i = 0; i < 100 && !gone; i++) {
    gone = process_gone(bg);
    if (!gone) usleep(20000);
  }
  CHECK(gone, "group member %d survived", (int)bg);
  close(c.master);

  // Never a wildcard: these would mean "our group" or "everyone".
  pty_exit unused;
  CHECK(pty_kill(0, SIGTERM) == EINVAL && pty_kill(1, SIGTERM) == EINVAL, "");
  CHECK(pty_reap(0, &unused) == EINVAL && pty_reap(-1, &unused) == EINVAL, "");
  CHECK(pty_await_exit(0) == EINVAL && pty_await_exit(-1) == EINVAL, "");
  return 0;
}

static int test_close_hangs_up(void) {
  char *argv[] = {"/bin/sh", "-c", "echo up; while :; do sleep 0.05; done", NULL};
  pty_child c;
  CHECK(spawn_ok(argv, sys_path, 24, 80, &c) == 0, "");
  char out[BUF];
  read_until(c.master, out, BUF, "up", T);
  close(c.master);
  pty_exit ex;
  CHECK(finish(c.pid, &ex) == 0, "");
  CHECK(ex.signal == SIGHUP, "code %d signal %d", ex.code, ex.signal);
  return 0;
}

static int test_path_lookup(void) {
  char out[BUF];
  pty_exit ex;
  char *printf_argv[] = {"printf", "found", NULL};
  // Relative and empty entries are skipped, missing dirs are fine.
  char *path_env[] = {"PATH=/nonexistent:relative/bin::/usr/bin:/bin", NULL};
  CHECK(run(printf_argv, path_env, NULL, out, &ex) == 0, "");
  CHECK(strcmp(out, "found") == 0 && ex.code == 0, "got '%s'", out);
  // No PATH at all: libc's default path.
  CHECK(run(printf_argv, no_env, NULL, out, &ex) == 0, "");
  CHECK(strcmp(out, "found") == 0, "got '%s'", out);

  // Our own PATH entry, and the lookup uses the child's PATH, not ours.
  char dir[PATH_MAX], bin[PATH_MAX + 8], prog[PATH_MAX + 16], env_path[PATH_MAX + 16];
  CHECK(make_temp_dir(dir) == 0, "");
  snprintf(bin, sizeof bin, "%s/bin", dir);
  snprintf(prog, sizeof prog, "%s/hello", bin);
  CHECK(mkdir(bin, 0700) == 0, "");
  FILE *f = fopen(prog, "w");
  CHECK(f != NULL, "");
  fputs("#!/bin/sh\necho hello-from-path\n", f);
  fclose(f);
  chmod(prog, 0700);
  snprintf(env_path, sizeof env_path, "PATH=%s", bin);
  char *hello_argv[] = {"hello", NULL};
  char *hello_env[] = {env_path, NULL};
  int err = run(hello_argv, hello_env, NULL, out, &ex);
  int found = err == 0 && strcmp(out, "hello-from-path\n") == 0;

  // A relative entry is not searched, even if it would match from the cwd.
  char *rel_env[] = {"PATH=bin", NULL};
  pty_child c;
  pty_stage stage;
  pty_spec spec = {.argv = hello_argv, .envp = rel_env, .cwd = dir, .rows = 24, .cols = 80};
  int rel_err = pty_spawn(&spec, &c, &stage);
  unlink(prog);
  rmdir(bin);
  rmdir(dir);
  CHECK(found, "err %d out '%s'", err, out);
  CHECK(rel_err == ENOENT && stage == PTY_STAGE_LOOKUP, "err %d stage %d", rel_err, stage);

  char *missing[] = {"pty-test-no-such-program", NULL};
  spec.argv = missing;
  spec.envp = sys_path;
  spec.cwd = NULL;
  CHECK(pty_spawn(&spec, &c, &stage) == ENOENT && stage == PTY_STAGE_LOOKUP, "");
  CHECK(no_children_left(), "");
  return 0;
}

static int test_exec_failure(void) {
  pty_child c;
  pty_stage stage;
  char *missing[] = {"/nonexistent/pty-test", NULL};
  pty_spec spec = {.argv = missing, .envp = no_env, .cwd = NULL, .rows = 24, .cols = 80};
  CHECK(pty_spawn(&spec, &c, &stage) == ENOENT && stage == PTY_STAGE_EXEC, "stage %d", stage);
  char *not_exec[] = {"/etc/hostname", NULL};
  if (access(not_exec[0], F_OK) != 0) not_exec[0] = "/etc/passwd";
  spec.argv = not_exec;
  CHECK(pty_spawn(&spec, &c, &stage) == EACCES && stage == PTY_STAGE_EXEC, "stage %d", stage);
  CHECK(no_children_left(), "failed spawn left a child");
  return 0;
}

static int expect_size(int master, const char *want) {
  char out[BUF];
  read_until(master, out, BUF, want, T);
  CHECK(strstr(out, want) != NULL, "want '%s' got '%s'", want, out);
  return 0;
}

static int expect_quiet(int master) {
  char out[BUF];
  CHECK(read_until(master, out, BUF, NULL, 400) == 0, "unexpected '%s'", out);
  return 0;
}

static int test_two_ptys_resize(void) {
  // Each child prints its size once its SIGWINCH trap is set, then again on
  // every SIGWINCH.
  char *argv[] = {"/bin/sh", "-c",
                  "trap 'stty size' WINCH; stty size; while :; do sleep 0.05; done", NULL};
  pty_child a, b;
  CHECK(spawn_ok(argv, sys_path, 24, 80, &a) == 0, "");
  CHECK(spawn_ok(argv, sys_path, 30, 100, &b) == 0, "");
  CHECK(expect_size(a.master, "24 80\n") == 0, "");
  CHECK(expect_size(b.master, "30 100\n") == 0, "");

  CHECK(pty_resize(a.master, 40, 120) == 0, "");
  CHECK(expect_size(a.master, "40 120\n") == 0, "");
  CHECK(expect_quiet(b.master) == 0, "resizing a signalled b");
  CHECK(pty_resize(b.master, 50, 132) == 0, "");
  CHECK(expect_size(b.master, "50 132\n") == 0, "");
  CHECK(expect_quiet(a.master) == 0, "resizing b signalled a");
  // Same size again still nudges the TUI (page reloads re-send their size).
  CHECK(pty_resize(a.master, 40, 120) == 0, "");
  CHECK(expect_size(a.master, "40 120\n") == 0, "");
  CHECK(expect_quiet(b.master) == 0, "same-size resize of a signalled b");

  pty_exit ea, eb;
  CHECK(pty_kill(a.pid, SIGTERM) == 0 && pty_kill(b.pid, SIGTERM) == 0, "");
  CHECK(finish(a.pid, &ea) == 0 && finish(b.pid, &eb) == 0, "");
  CHECK(ea.signal == SIGTERM && eb.signal == SIGTERM, "signals %d %d", ea.signal, eb.signal);
  close(a.master);
  close(b.master);
  return 0;
}

static const struct {
  const char *name;
  int (*fn)(void);
} cases[] = {
    {"output round trip", test_output_round_trip},
    {"input round trip", test_input_round_trip},
    {"exit status", test_exit_status},
    {"master flags, raw tty, size at open", test_master_and_tty_modes},
    {"cooked tty when asked, for a shell", test_cooked_tty},
    {"controlling tty, or none when handed on", test_hand_over},
    {"env is exactly ours", test_env_is_exact},
    {"cwd applied", test_cwd},
    {"fds >= 3 closed", test_fds_closed},
    {"signal mask and dispositions reset", test_signals_reset},
    {"kill hits the whole group", test_kill_group},
    {"close hangs up the child", test_close_hangs_up},
    {"PATH lookup for a bare name", test_path_lookup},
    {"exec failure reported, no zombie", test_exec_failure},
    {"two PTYs, independent resize", test_two_ptys_resize},
};

int main(void) {
  int failed = 0;
  size_t total = sizeof cases / sizeof cases[0];
  for (size_t i = 0; i < total; i++) {
    int r = cases[i].fn();
    printf("%s %s\n", r ? "FAIL" : "ok  ", cases[i].name);
    fflush(stdout);
    failed += r != 0;
  }
  if (!no_children_left()) {
    printf("FAIL children left behind\n");
    failed++;
  }
  printf("%zu cases, %d failed\n", total, failed);
  return failed ? 1 : 0;
}
