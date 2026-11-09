#define _GNU_SOURCE
#include "harness.h"

#include <errno.h>
#include <limits.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <time.h>

void check_failed(const char *file, int line, const char *expr, const char *fmt, ...) {
  fprintf(stderr, "  %s:%d: CHECK(%s) failed", file, line, expr);
  if (fmt && fmt[0]) {
    va_list ap;
    va_start(ap, fmt);
    fputs(": ", stderr);
    vfprintf(stderr, fmt, ap);
    va_end(ap);
  }
  fputc('\n', stderr);
}

long now_ms(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return ts.tv_sec * 1000L + ts.tv_nsec / 1000000L;
}

size_t read_until(int master, char *buf, size_t cap, const char *needle, int timeout_ms) {
  size_t len = 0;
  long deadline = now_ms() + timeout_ms;
  buf[0] = '\0';
  while (len + 1 < cap && !(needle && strstr(buf, needle))) {
    long left = deadline - now_ms();
    if (left <= 0) break;
    int r = pty_wait_readable(master, (int)left);
    if (r < 0) break;
    if (r == 0) continue;  // timeout (the loop ends) or a signal
    ssize_t n = pty_read(master, buf + len, cap - 1 - len);
    if (n < 0) break;  // EIO: the child side is closed
    len += (size_t)n;
    buf[len] = '\0';
  }
  return len;
}

int finish(pid_t pid, pty_exit *out) {
  int err = pty_await_exit(pid);
  return err ? err : pty_reap(pid, out);
}

int no_children_left(void) {
  // The test process is ours alone, so a wildcard wait is fine here (the app
  // itself never does this).
  return waitpid(-1, NULL, WNOHANG) < 0 && errno == ECHILD;
}

int make_temp_dir(char *buf) {
  const char *base = getenv("TMPDIR");
  char tmpl[PATH_MAX];
  snprintf(tmpl, sizeof tmpl, "%s/pty-test-XXXXXX", base && base[0] ? base : "/tmp");
  if (!mkdtemp(tmpl)) return errno;
  if (!realpath(tmpl, buf)) return errno;
  return 0;
}
