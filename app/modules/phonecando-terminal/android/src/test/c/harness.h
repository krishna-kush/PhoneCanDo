// Small harness for the pty core host test: CHECK reports and bails out of
// the current case; the helpers drive a PTY through the core's own API.
#ifndef PTY_TEST_HARNESS_H
#define PTY_TEST_HARNESS_H

#include <stddef.h>

#include "pty.h"

#define CHECK(cond, ...)                                     \
  do {                                                       \
    if (!(cond)) {                                           \
      check_failed(__FILE__, __LINE__, #cond, __VA_ARGS__);  \
      return 1;                                              \
    }                                                        \
  } while (0)

void check_failed(const char *file, int line, const char *expr, const char *fmt, ...);

// Monotonic clock, in milliseconds.
long now_ms(void);

// Reads into buf (always NUL-terminated) until `needle` shows up, the child
// side closes, or timeout_ms passes. A NULL needle reads to close/timeout.
size_t read_until(int master, char *buf, size_t cap, const char *needle, int timeout_ms);

// Waits for pid to exit, then reaps it.
int finish(pid_t pid, pty_exit *out);

// True when this test process has no child left, running or zombie.
int no_children_left(void);

// Makes a fresh temp directory; puts its real path in buf (PATH_MAX bytes).
int make_temp_dir(char *buf);

#endif
