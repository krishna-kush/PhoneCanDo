/* The launcher's one way to fail (die.h). */
#include "die.h"

#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>

_Noreturn void lc_die(const char *fmt, ...) {
  va_list ap;
  fputs("phonecando-launch: ", stderr);
  va_start(ap, fmt);
  vfprintf(stderr, fmt, ap);
  va_end(ap);
  fputc('\n', stderr);
  exit(127);
}
