// Bytes and window size on the (non-blocking) master side.
#include "pty.h"

#include <errno.h>
#include <poll.h>
#include <signal.h>
#include <string.h>
#include <sys/ioctl.h>
#include <termios.h>
#include <unistd.h>

// Write retries wait up to this long for room each time, and give up after
// this many waits in a row without progress (about a second).
#define WRITE_WAIT_MS 100
#define WRITE_MAX_STALLS 10

ssize_t pty_read(int master, void *buf, size_t len) {
  ssize_t n = read(master, buf, len);
  if (n < 0 && (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR)) return 0;
  return n;
}

size_t pty_write_all(int master, const void *buf, size_t len) {
  const char *p = buf;
  size_t total = 0;
  int stalls = 0;
  while (total < len) {
    ssize_t n = write(master, p + total, len - total);
    if (n > 0) {
      total += (size_t)n;
      stalls = 0;
      continue;
    }
    if (n < 0 && errno == EINTR) continue;
    if (n < 0 && (errno == EAGAIN || errno == EWOULDBLOCK) && stalls++ < WRITE_MAX_STALLS) {
      struct pollfd pfd = {.fd = master, .events = POLLOUT, .revents = 0};
      poll(&pfd, 1, WRITE_WAIT_MS);
      continue;
    }
    break;
  }
  return total;
}

int pty_resize(int master, unsigned short rows, unsigned short cols) {
  struct winsize ws, old;
  memset(&ws, 0, sizeof ws);
  ws.ws_row = rows;
  ws.ws_col = cols;
  int same = ioctl(master, TIOCGWINSZ, &old) == 0 && memcmp(&old, &ws, sizeof ws) == 0;
  if (ioctl(master, TIOCSWINSZ, &ws) != 0) return errno;
  // The kernel signals the foreground group only when the size changes. The
  // page re-sends its size after a reload, and the TUI repaints on SIGWINCH,
  // so we keep one signal per resize: same size, we send it ourselves, to
  // this terminal's own foreground group (never a remembered pid).
  if (same) {
    pid_t group = tcgetpgrp(master);
    if (group > 1) kill(-group, SIGWINCH);
  }
  return 0;
}
