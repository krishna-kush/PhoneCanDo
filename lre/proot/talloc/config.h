/*
 * Hand-written config.h for compiling talloc.c on its own (lre/proot/steps/
 * talloc.sh), in place of the one talloc's waf configure generates.
 *
 * Why not waf: cross-compiling it needs python, --cross-compile and a
 * cross-answers file, and builds libreplace and the python bindings we do
 * not want. proot needs only talloc.c, which reads a handful of these macros;
 * everything else in lib/replace/replace.h only declares fallbacks.
 *
 * Valid for both targets we build: bionic at API 29 (aarch64 Android) and
 * glibc. Each HAVE_ below exists on both; leaving one out makes replace.h
 * rename that call to rep_<name>, which talloc.sh refuses (no undefined
 * rep_* other than rep_memset_explicit, provided by memset_explicit.c,
 * because bionic only gained memset_explicit at API 34).
 *
 * TALLOC_BUILD_VERSION_{MAJOR,MINOR,RELEASE} come from pins.env as -D flags;
 * talloc.c #errors if they disagree with talloc.h.
 */
#ifndef PHONECANDO_TALLOC_CONFIG_H
#define PHONECANDO_TALLOC_CONFIG_H

/* Headers replace.h may include. */
#define STDC_HEADERS 1
#define HAVE_STDINT_H 1
#define HAVE_INTTYPES_H 1
#define HAVE_STDBOOL_H 1
#define HAVE_STRING_H 1
#define HAVE_STRINGS_H 1
#define HAVE_UNISTD_H 1
#define HAVE_SYS_TYPES_H 1
#define HAVE_LIMITS_H 1
#define HAVE_DLFCN_H 1
#define HAVE_SYS_AUXV_H 1

/* Types replace.h would otherwise typedef. */
#define HAVE_BOOL 1
#define HAVE_INTPTR_T 1
#define HAVE_UINTPTR_T 1
#define HAVE_PTRDIFF_T 1

/* libc calls talloc.c (or replace.h's inline helpers) makes. */
#define HAVE_MEMMOVE 1
#define HAVE_STRNLEN 1
#define HAVE_VSNPRINTF 1
#define HAVE_C99_VSNPRINTF 1
#define HAVE_VA_COPY 1
#define HAVE_USLEEP 1
#define HAVE_DLOPEN 1
#define HAVE_DLSYM 1
#define HAVE_DLERROR 1
#define HAVE_DLCLOSE 1

/* talloc_lib_init() runs as a constructor and seeds the chunk magic from
 * getauxval(AT_RANDOM), as in a waf build (bionic has getauxval since API 18). */
#define HAVE_CONSTRUCTOR_ATTRIBUTE 1
#define HAVE_GETAUXVAL 1
#define HAVE_VISIBILITY_ATTR 1

#endif /* PHONECANDO_TALLOC_CONFIG_H */
