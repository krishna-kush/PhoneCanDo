/*
 * Unit tests of the pure parts (conf.c, plan.c): the edges the end-to-end
 * tests in run.sh cannot reach cheaply. Built and run by run.sh.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "conf.h"
#include "plan.h"

static int failures;
static char buf[LC_MAX_BYTES + 64];
static struct lc_conf conf;

#define CHECK(cond)                                                     \
  do {                                                                  \
    if (!(cond)) {                                                      \
      fprintf(stderr, "unit.c:%d: FAIL %s\n", __LINE__, #cond);         \
      failures++;                                                       \
    }                                                                   \
  } while (0)

/* Parses text; returns the error's what (NULL on success) and its line. */
static const char *parse(const char *text, size_t *line) {
  struct lc_error err = {0, NULL};
  size_t len = strlen(text);
  memcpy(buf, text, len);
  int rc = lc_parse(buf, len, &conf, &err);
  if (line) *line = err.line;
  return rc ? err.what : NULL;
}

static void test_parse(void) {
  size_t line;

  CHECK(!parse("# c\n\narg /p\narg two words  \n", NULL));
  CHECK(conf.count == 2 && conf.args == 2 && !strcmp(conf.entries[1].value, "two words  "));
  CHECK(!strcmp(conf.home, "/"));
  CHECK(!parse("arg /p", NULL)); /* no newline at the end */
  CHECK(!parse("arg /p\narg \n", NULL) && !strcmp(conf.entries[1].value, ""));

  CHECK(!strcmp(parse("arg /p\nfoo x\n", &line), "unknown keyword") && line == 2);
  CHECK(!strcmp(parse("arg /p\n home /\n", &line), "unknown keyword") && line == 2);
  CHECK(!strcmp(parse("arg\n", &line), "missing value") && line == 1);
  CHECK(!strcmp(parse("arg proot\n", &line), "the first arg must be the absolute path of proot"));
  CHECK(!strcmp(parse("# only comments\n", &line), "no arg line") && line == 0);
  CHECK(!strcmp(parse("arg /p\nset NOEQ\n", NULL), "set needs KEY=VALUE"));
  CHECK(!strcmp(parse("arg /p\nset =v\n", NULL), "set needs KEY=VALUE"));
  CHECK(!strcmp(parse("arg /p\nunset \n", NULL), "unset needs a NAME"));
  CHECK(!strcmp(parse("arg /p\nunset A=B\n", NULL), "unset needs a NAME"));
  CHECK(!strcmp(parse("arg /p\nunset A*B\n", NULL), "unset allows '*' only at the end"));
  CHECK(!strcmp(parse("arg /p\nmap bash\n", NULL), "map needs NAME GUEST"));
  CHECK(!strcmp(parse("arg /p\nmap bash /bin/sh -x\n", NULL), "map needs NAME GUEST"));
  CHECK(!strcmp(parse("arg /p\nmap  /bin/sh\n", NULL), "map needs NAME GUEST"));
  CHECK(!strcmp(parse("arg /p\nsame rel\n", NULL), "same needs an absolute path"));
  CHECK(!strcmp(parse("arg /p\nhome rel\n", NULL), "home needs an absolute path"));
  CHECK(!parse("arg /p\nhome /a\nhome /b\n", NULL) && !strcmp(conf.home, "/b"));

  /* NUL byte, line and byte limits. */
  struct lc_error err;
  memcpy(buf, "arg /p\n\0\n", 9);
  CHECK(lc_parse(buf, 9, &conf, &err) == -1 && !strcmp(err.what, "contains a NUL byte"));

  size_t len = 0;
  len += (size_t)sprintf(buf, "arg /p\n");
  for (int i = 1; i < LC_MAX_LINES; i++) buf[len++] = '\n';
  CHECK(lc_parse(buf, len, &conf, &err) == 0); /* exactly 4096 lines */
  len = 0;
  len += (size_t)sprintf(buf, "arg /p\n");
  for (int i = 1; i <= LC_MAX_LINES; i++) buf[len++] = '\n';
  CHECK(lc_parse(buf, len, &conf, &err) == -1 && err.line == LC_MAX_LINES + 1);

  memset(buf, '#', LC_MAX_BYTES + 1);
  memcpy(buf, "arg /p\n", 7);
  CHECK(lc_parse(buf, LC_MAX_BYTES + 1, &conf, &err) == -1 && !strcmp(err.what, "over 256 KiB"));
}

static void test_command(void) {
  CHECK(!parse("arg /p\nmap bash /bin/sh\nmap vi /usr/bin/vim\nmap vi /usr/bin/nvim\n", NULL));
  CHECK(!strcmp(lc_command(&conf, "/x/shims/git"), "git"));
  CHECK(!strcmp(lc_command(&conf, "git"), "git"));
  CHECK(!strcmp(lc_command(&conf, "/x/shims/bash"), "/bin/sh"));
  CHECK(!strcmp(lc_command(&conf, "/data/app/lib/arm64/libphonecando_launch.so"), "/bin/sh"));
  CHECK(!strcmp(lc_command(&conf, "vi"), "/usr/bin/nvim")); /* the later map wins */
  CHECK(!strcmp(lc_command(&conf, "lib.so"), "/bin/sh"));
  CHECK(!strcmp(lc_command(&conf, "libx.sox"), "libx.sox"));
  CHECK(lc_command(&conf, NULL) == NULL);
  CHECK(lc_command(&conf, "/x/") == NULL);
}

static void test_cwd(void) {
  CHECK(!parse("arg /p\nsame /data/proj/\nsame /\nhome /root\n", NULL));
  CHECK(!strcmp(lc_cwd(&conf, "/anything"), "/anything")); /* same / binds all */
  CHECK(!parse("arg /p\nsame /data/proj/\nsame /sdcard\nhome /root\n", NULL));
  CHECK(!strcmp(lc_cwd(&conf, "/data/proj"), "/data/proj"));
  CHECK(!strcmp(lc_cwd(&conf, "/data/proj/a/b"), "/data/proj/a/b"));
  CHECK(!strcmp(lc_cwd(&conf, "/sdcard/x"), "/sdcard/x"));
  CHECK(!strcmp(lc_cwd(&conf, "/data/project2"), "/root"));
  CHECK(!strcmp(lc_cwd(&conf, "/data"), "/root"));
  CHECK(!strcmp(lc_cwd(&conf, NULL), "/root"));
  CHECK(!strcmp(lc_cwd(&conf, "relative"), "/root"));
}

static void test_env(void) {
  char *env[] = {"PATH=/host", "LD_PRELOAD=x", "LD_X=y", "A=1", "AB=2", "KEEP=k", "LD_", NULL};
  const char *out[16];
  CHECK(!parse("arg /p\nunset LD_*\nunset A\nset PATH=/g\nset LD_LIBRARY_PATH=/l\n"
               "set K=1\nset K=2\n", NULL));
  size_t n = lc_env(&conf, env, out);
  /* Inherited survivors first, then each set; the earlier K=1 is replaced. */
  const char *want[] = {"AB=2", "KEEP=k", "PATH=/g", "LD_LIBRARY_PATH=/l", "K=2"};
  CHECK(n == 5 && out[5] == NULL);
  for (size_t i = 0; i < 5 && i < n; i++) CHECK(!strcmp(out[i], want[i]));
  CHECK(lc_env(&conf, NULL, out) == 3);
}

static void test_argv(void) {
  char *extra[] = {"status", "two words"};
  const char *out[16];
  CHECK(!parse("arg /p\narg -r\narg /img\nset A=1\narg -0\n", NULL));
  size_t n = lc_argv(&conf, "--cwd=/w", "git", extra, 2, out);
  const char *want[] = {"/p", "-r", "/img", "-0", "--cwd=/w", "git", "status", "two words"};
  CHECK(n == 8 && out[8] == NULL);
  for (size_t i = 0; i < 8 && i < n; i++) CHECK(!strcmp(out[i], want[i]));
}

int main(void) {
  test_parse();
  test_command();
  test_cwd();
  test_env();
  test_argv();
  if (failures) {
    fprintf(stderr, "unit: %d failure(s)\n", failures);
    return 1;
  }
  puts("unit: all passed");
  return 0;
}
