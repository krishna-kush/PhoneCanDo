/*
 * The --status-fd side of proot (lre/proot/patches/0002-status-fd.patch),
 * for the launcher tests: fake-proot.sh execs it once it has printed what it
 * was given. Built by run.sh.
 *
 *   fake-tracer <fd> <mode> <linger> <command>...
 *
 * report  fork <command>, write its pid on fd, leave the session and point
 *         stdin and stdout at /dev/null (as proot does), wait for it, write
 *         its waitpid() status, close fd and point stderr at /dev/null, then
 *         stay <linger> seconds, like a proot tracing what the command left
 * slow    the same, one second later: the pid is not known at once
 * die:N   fork <command>, write its pid, then die by signal N (proot killed)
 * fail:N  write nothing, say so on stderr and exit N (proot failed to start)
 */
#define _POSIX_C_SOURCE 200809L

#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

static void report(int fd, int value) {
  if (write(fd, &value, sizeof value) != (ssize_t)sizeof value) perror("fake-tracer: write");
}

static void to_dev_null(int fd) {
  int null = open("/dev/null", O_RDWR);
  if (null >= 0 && null != fd) {
    dup2(null, fd);
    close(null);
  }
}

static void pause_seconds(int seconds) {
  struct timespec t = {seconds, 0};
  while (nanosleep(&t, &t) != 0) {
  }
}

int main(int argc, char **argv) {
  if (argc < 5) {
    fputs("usage: fake-tracer <fd> <mode> <linger> <command>...\n", stderr);
    return 99;
  }
  int fd = atoi(argv[1]);
  const char *mode = argv[2];
  int linger = atoi(argv[3]);

  if (!strncmp(mode, "fail:", 5)) {
    fputs("fake-tracer: cannot start\n", stderr);
    return atoi(mode + 5);
  }

  pid_t main_pid = fork();
  if (main_pid < 0) return 98;
  if (main_pid == 0) {
    close(fd);
    execvp(argv[4], argv + 4);
    perror("fake-tracer: exec");
    _exit(97);
  }

  if (!strcmp(mode, "slow")) pause_seconds(1);
  report(fd, main_pid);
  if (!strncmp(mode, "die:", 4)) {
    int sig = atoi(mode + 4);
    signal(sig, SIG_DFL);
    raise(sig);
    return 96;
  }
  setsid();
  to_dev_null(STDIN_FILENO);
  to_dev_null(STDOUT_FILENO);

  int status;
  while (waitpid(main_pid, &status, 0) < 0) {
    if (errno != EINTR) return 95;
  }
  report(fd, status);
  close(fd);
  to_dev_null(STDERR_FILENO);
  pause_seconds(linger);
  return 0;
}
