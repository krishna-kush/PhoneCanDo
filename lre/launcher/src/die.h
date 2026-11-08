/* How every launcher error ends it: "phonecando-launch: <reason>" on stderr, exit 127. */
#ifndef PHONECANDO_LAUNCH_DIE_H
#define PHONECANDO_LAUNCH_DIE_H

_Noreturn void lc_die(const char *fmt, ...) __attribute__((format(printf, 1, 2)));

#endif
