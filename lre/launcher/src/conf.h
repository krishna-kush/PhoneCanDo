/*
 * launch.conf: how the launcher starts proot for one Linux image. Our Kotlin
 * side writes it per image at $PHONECANDO_IMAGE/run/launch.conf; this file
 * is the contract between the two.
 *
 * One directive per line: <keyword><one space><value>. The value is the rest
 * of the line verbatim (it may contain spaces, never a newline). Empty lines
 * and lines starting with '#' are ignored; any other keyword is an error. At
 * most 256 KiB and 4096 lines.
 *
 *   arg VALUE       one proot argv entry, in order; the first `arg` is the
 *                   absolute path of the proot binary
 *   set KEY=VALUE   set KEY in the environment proot (and so the guest) gets
 *   unset NAME      remove NAME from the inherited environment; a NAME ending
 *                   in '*' removes every variable with that prefix (LD_*)
 *   map NAME GUEST  invoked as NAME, run GUEST instead (map bash /bin/sh for
 *                   an image without bash); both are single tokens
 *   same PATH       host PATH is bound at the same path in the guest, so a
 *                   current dir equal to or under it stays the guest cwd
 *   home PATH       guest cwd when the current dir is under no `same` path
 *                   (default /)
 *
 * The launcher then runs, never forking:
 *   environment  the inherited one, every `unset` applied first, then every
 *                `set` (set wins; for a KEY set twice the later line wins)
 *   command      basename(argv[0]); our own file name (lib*.so) means bash,
 *                so SHELL can point at the launcher itself; then `map` (the
 *                later line wins)
 *   cwd          the current dir when it is at or under a `same` path, else
 *                `home` (the later line wins)
 *   execve       arg..., --cwd=<cwd>, command, argv[1..]
 *
 * Any error (no PHONECANDO_IMAGE, unreadable or invalid conf, no `arg`, exec
 * failure) prints "phonecando-launch: <reason>" to stderr and exits 127.
 *
 * This header and conf.c are pure: no IO, no allocation.
 */
#ifndef PHONECANDO_LAUNCH_CONF_H
#define PHONECANDO_LAUNCH_CONF_H

#include <stddef.h>

#define LC_MAX_BYTES (256 * 1024)
#define LC_MAX_LINES 4096

enum lc_kind { LC_ARG, LC_SET, LC_UNSET, LC_MAP, LC_SAME, LC_HOME };

struct lc_entry {
  enum lc_kind kind;
  char *value; /* the value; for map, NAME */
  char *guest; /* map only: GUEST */
};

struct lc_conf {
  struct lc_entry entries[LC_MAX_LINES];
  size_t count;
  size_t args; /* how many entries are `arg` */
  size_t sets; /* how many entries are `set` */
  const char *home;
};

struct lc_error {
  size_t line; /* 1-based; 0 for the whole file */
  const char *what;
};

/*
 * Parses buf[0..len) in place: line ends and the space in `map` become NULs
 * and the entries point into buf, so buf must hold len + 1 bytes and outlive
 * conf. Returns 0, or -1 with *err set.
 */
int lc_parse(char *buf, size_t len, struct lc_conf *conf, struct lc_error *err);

#endif
