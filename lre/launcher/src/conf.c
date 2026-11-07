/* launch.conf parser (format: conf.h). Pure: no IO, no allocation. */
#include "conf.h"

#include <string.h>

static const struct {
  const char *word;
  enum lc_kind kind;
} keywords[] = {
  {"arg", LC_ARG},   {"set", LC_SET},   {"unset", LC_UNSET},
  {"map", LC_MAP},   {"same", LC_SAME}, {"home", LC_HOME},
};

static int fail(struct lc_error *err, size_t line, const char *what) {
  err->line = line;
  err->what = what;
  return -1;
}

static int keyword(const char *word, size_t len, enum lc_kind *kind) {
  for (size_t i = 0; i < sizeof keywords / sizeof keywords[0]; i++) {
    if (strlen(keywords[i].word) == len && !strncmp(keywords[i].word, word, len)) {
      *kind = keywords[i].kind;
      return 0;
    }
  }
  return -1;
}

/* Parses one NUL-terminated directive line into the next entry. */
static int directive(struct lc_conf *conf, char *line, size_t no, struct lc_error *err) {
  char *space = strchr(line, ' ');
  size_t len = space ? (size_t)(space - line) : strlen(line);
  struct lc_entry *e = &conf->entries[conf->count];

  if (keyword(line, len, &e->kind)) return fail(err, no, "unknown keyword");
  if (!space) return fail(err, no, "missing value");
  e->value = space + 1;
  e->guest = NULL;

  switch (e->kind) {
  case LC_ARG:
    if (!conf->args && e->value[0] != '/') {
      return fail(err, no, "the first arg must be the absolute path of proot");
    }
    conf->args++;
    break;
  case LC_SET: {
    char *eq = strchr(e->value, '=');
    if (!eq || eq == e->value) return fail(err, no, "set needs KEY=VALUE");
    conf->sets++;
    break;
  }
  case LC_UNSET: {
    char *star = strchr(e->value, '*');
    if (!e->value[0] || strchr(e->value, '=')) return fail(err, no, "unset needs a NAME");
    if (star && star[1]) return fail(err, no, "unset allows '*' only at the end");
    break;
  }
  case LC_MAP: {
    char *sep = strchr(e->value, ' ');
    if (!sep || sep == e->value || !sep[1] || strchr(sep + 1, ' ')) {
      return fail(err, no, "map needs NAME GUEST");
    }
    *sep = '\0';
    e->guest = sep + 1;
    break;
  }
  case LC_SAME:
    if (e->value[0] != '/') return fail(err, no, "same needs an absolute path");
    break;
  case LC_HOME:
    if (e->value[0] != '/') return fail(err, no, "home needs an absolute path");
    conf->home = e->value;
    break;
  }
  conf->count++;
  return 0;
}

int lc_parse(char *buf, size_t len, struct lc_conf *conf, struct lc_error *err) {
  char *p = buf, *end = buf + len;
  size_t no = 0;

  conf->count = conf->args = conf->sets = 0;
  conf->home = "/";
  if (len > LC_MAX_BYTES) return fail(err, 0, "over 256 KiB");
  if (memchr(buf, '\0', len)) return fail(err, 0, "contains a NUL byte");
  *end = '\0';

  while (p < end) {
    char *nl = memchr(p, '\n', (size_t)(end - p));
    char *eol = nl ? nl : end;
    *eol = '\0';
    if (++no > LC_MAX_LINES) return fail(err, no, "over 4096 lines");
    if (*p && *p != '#' && directive(conf, p, no, err)) return -1;
    p = eol + 1;
  }
  if (!conf->args) return fail(err, 0, "no arg line");
  return 0;
}
