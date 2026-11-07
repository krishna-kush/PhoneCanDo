/*
 * phonecando-launch: runs one command inside a Linux image through proot.
 * Multi-call: shims named after guest commands (git, bash, ...) are symlinks
 * to this executable, which ships as libphonecando_launch.so. Reads
 * $PHONECANDO_IMAGE/run/launch.conf (format and rules: conf.h) and execs
 * proot in place; it never forks. This file is the IO; conf.c and plan.c
 * are the pure parts.
 */
#define _POSIX_C_SOURCE 200809L

#include <errno.h>
#include <fcntl.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "conf.h"
#include "plan.h"

extern char **environ;

#define CONF_PATH "/run/launch.conf"
#define CWD_FLAG "--cwd="
#define PATH_BYTES 4096

/* Static: the parsed entries point into buf, and both are too big for a stack. */
static char buf[LC_MAX_BYTES + 2];
static struct lc_conf conf;

static _Noreturn void die(const char *fmt, ...) {
  va_list ap;
  fputs("phonecando-launch: ", stderr);
  va_start(ap, fmt);
  vfprintf(stderr, fmt, ap);
  va_end(ap);
  fputc('\n', stderr);
  exit(127);
}

/* Reads up to LC_MAX_BYTES + 1 bytes, so an oversize file shows as one. */
static size_t read_conf(const char *path) {
  size_t len = 0;
  int fd = open(path, O_RDONLY | O_CLOEXEC);
  if (fd < 0) die("cannot read %s: %s", path, strerror(errno));
  while (len < LC_MAX_BYTES + 1) {
    ssize_t n = read(fd, buf + len, LC_MAX_BYTES + 1 - len);
    if (n < 0 && errno == EINTR) continue;
    if (n < 0) die("cannot read %s: %s", path, strerror(errno));
    if (n == 0) break;
    len += (size_t)n;
  }
  close(fd);
  return len;
}

static void *alloc(size_t count, size_t size) {
  void *p = calloc(count, size);
  if (!p) die("out of memory");
  return p;
}

int main(int argc, char **argv) {
  const char *image = getenv("PHONECANDO_IMAGE");
  char path[PATH_BYTES], cwd_buf[PATH_BYTES];
  struct lc_error err;

  if (!image || !*image) die("PHONECANDO_IMAGE is not set");
  if (image[0] != '/') die("PHONECANDO_IMAGE is not an absolute path");
  if ((size_t)snprintf(path, sizeof path, "%s%s", image, CONF_PATH) >= sizeof path) {
    die("PHONECANDO_IMAGE is too long");
  }

  size_t len = read_conf(path);
  if (lc_parse(buf, len, &conf, &err)) {
    if (err.line) die("%s:%zu: %s", path, err.line, err.what);
    die("%s: %s", path, err.what);
  }

  const char *command = lc_command(&conf, argc > 0 ? argv[0] : NULL);
  if (!command) die("no command name in argv[0]");

  /* An unreadable current dir (deleted, too long) is under no `same` path. */
  const char *cwd = lc_cwd(&conf, getcwd(cwd_buf, sizeof cwd_buf));
  char *cwd_arg = alloc(strlen(CWD_FLAG) + strlen(cwd) + 1, 1);
  strcat(strcpy(cwd_arg, CWD_FLAG), cwd);

  size_t nextra = argc > 1 ? (size_t)argc - 1 : 0;
  const char **args = alloc(conf.args + nextra + 3, sizeof *args);
  lc_argv(&conf, cwd_arg, command, argv + 1, nextra, args);

  size_t nenv = 0;
  while (environ && environ[nenv]) nenv++;
  const char **env = alloc(nenv + conf.sets + 1, sizeof *env);
  lc_env(&conf, environ, env);

  execve(args[0], (char *const *)args, (char *const *)env);
  die("cannot run %s: %s", args[0], strerror(errno));
}
