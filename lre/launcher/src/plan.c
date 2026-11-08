/* The exec plan: command, cwd, argv and environment (rules: conf.h). Pure. */
#include "plan.h"

#include <string.h>

/* Our own file name: the launcher ships as lib<name>.so. */
static int is_self(const char *name) {
  size_t n = strlen(name);
  return n >= 6 && !strncmp(name, "lib", 3) && !strcmp(name + n - 3, ".so");
}

const char *lc_command(const struct lc_conf *conf, const char *argv0) {
  const char *slash, *name;

  if (!argv0) return NULL;
  slash = strrchr(argv0, '/');
  name = slash ? slash + 1 : argv0;
  if (!*name) return NULL;
  if (is_self(name)) name = "bash";

  const char *run = name;
  for (size_t i = 0; i < conf->count; i++) {
    const struct lc_entry *e = &conf->entries[i];
    if (e->kind == LC_MAP && !strcmp(e->value, name)) run = e->guest;
  }
  return run;
}

/* cwd equals root or lies under it; root is absolute, trailing '/' allowed. */
static int under(const char *cwd, const char *root) {
  size_t n = strlen(root);
  while (n > 1 && root[n - 1] == '/') n--;
  if (n == 1) return 1;
  return !strncmp(cwd, root, n) && (cwd[n] == '\0' || cwd[n] == '/');
}

const char *lc_cwd(const struct lc_conf *conf, const char *cwd) {
  if (cwd && cwd[0] == '/') {
    for (size_t i = 0; i < conf->count; i++) {
      const struct lc_entry *e = &conf->entries[i];
      if (e->kind == LC_SAME && under(cwd, e->value)) return cwd;
    }
  }
  return conf->home;
}

size_t lc_argv(const struct lc_conf *conf, const char *const *own, size_t nown, const char *command,
               char *const *extra, size_t nextra, const char **out) {
  size_t n = 0;
  for (size_t i = 0; i < conf->count; i++) {
    if (conf->entries[i].kind == LC_ARG) out[n++] = conf->entries[i].value;
  }
  for (size_t i = 0; i < nown; i++) out[n++] = own[i];
  out[n++] = command;
  for (size_t i = 0; i < nextra; i++) out[n++] = extra[i];
  out[n] = NULL;
  return n;
}

static size_t key_len(const char *entry) {
  const char *eq = strchr(entry, '=');
  return eq ? (size_t)(eq - entry) : strlen(entry);
}

static int same_key(const char *a, const char *b) {
  size_t n = key_len(a);
  return key_len(b) == n && !strncmp(a, b, n);
}

/* `unset NAME` drops the variable NAME; `unset PREFIX*` every PREFIX... one. */
static int unset_drops(const char *name, const char *entry) {
  size_t n = strlen(name);
  if (name[n - 1] == '*') return !strncmp(entry, name, n - 1);
  return key_len(entry) == n && !strncmp(entry, name, n);
}

static int dropped(const struct lc_conf *conf, const char *entry) {
  for (size_t i = 0; i < conf->count; i++) {
    const struct lc_entry *e = &conf->entries[i];
    if (e->kind == LC_UNSET && unset_drops(e->value, entry)) return 1;
    if (e->kind == LC_SET && same_key(e->value, entry)) return 1;
  }
  return 0;
}

/* A later `set` of the same KEY replaces this one. */
static int set_again(const struct lc_conf *conf, size_t at) {
  for (size_t i = at + 1; i < conf->count; i++) {
    const struct lc_entry *e = &conf->entries[i];
    if (e->kind == LC_SET && same_key(e->value, conf->entries[at].value)) return 1;
  }
  return 0;
}

size_t lc_env(const struct lc_conf *conf, char *const *env, const char **out) {
  size_t n = 0;
  for (; env && *env; env++) {
    if (!dropped(conf, *env)) out[n++] = *env;
  }
  for (size_t i = 0; i < conf->count; i++) {
    if (conf->entries[i].kind == LC_SET && !set_again(conf, i)) out[n++] = conf->entries[i].value;
  }
  out[n] = NULL;
  return n;
}
