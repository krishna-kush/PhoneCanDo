// Program lookup for pty_spawn (internal to the pty core).
#ifndef PHONECANDO_PTY_PATH_H
#define PHONECANDO_PTY_PATH_H

#include <stddef.h>

// Finds the file to execve for `name`. A name with a '/' is used as is;
// a bare name is searched on PATH from `envp` (the child's environment, not
// ours). On success *path points at `name` or into `buf`.
int pty_find_program(const char *name, char *const envp[], char *buf, size_t size,
                     const char **path);

#endif
