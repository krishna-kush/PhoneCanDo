/*
 * rep_memset_explicit() for our static talloc build (lre/proot/steps/
 * talloc.sh). talloc.c zeroes grown arrays with memset_explicit(); replace.h
 * maps that to rep_memset_explicit when the libc lacks it (bionic before API
 * 34, older glibc), and a waf build takes it from libreplace, which we do not
 * build. Same behaviour as libreplace's: memset, then a compiler barrier so
 * the store is not optimised away.
 *
 * Part of the talloc build, so under talloc's licence: LGPL-3.0-or-later.
 */
#include <stddef.h>
#include <string.h>

void *rep_memset_explicit(void *block, int c, size_t size);

void *rep_memset_explicit(void *block, int c, size_t size)
{
	void *ptr = memset(block, c, size);
	__asm__ volatile("" : : "r"(block) : "memory");
	return ptr;
}
