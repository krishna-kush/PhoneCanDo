/*
 * What the launcher execs, from a parsed launch.conf (rules: conf.h). Pure:
 * no IO, no allocation; the caller sizes the output arrays.
 */
#ifndef PHONECANDO_LAUNCH_PLAN_H
#define PHONECANDO_LAUNCH_PLAN_H

#include <stddef.h>

#include "conf.h"

/* The guest command for argv[0], or NULL when it has no name. */
const char *lc_command(const struct lc_conf *conf, const char *argv0);

/* The guest cwd for the current dir (NULL when unknown). */
const char *lc_cwd(const struct lc_conf *conf, const char *cwd);

/*
 * proot's argv: every `arg`, cwd_arg (--cwd=...), command, extra[0..nextra),
 * then NULL. out holds conf->args + nextra + 3 slots. Returns the count.
 */
size_t lc_argv(const struct lc_conf *conf, const char *cwd_arg, const char *command,
               char *const *extra, size_t nextra, const char **out);

/*
 * proot's environment: env (NULL-terminated) without what `unset` and `set`
 * replace, then every `set`, then NULL. out holds the env count +
 * conf->sets + 1 slots. Returns the count.
 */
size_t lc_env(const struct lc_conf *conf, char *const *env, const char **out);

#endif
