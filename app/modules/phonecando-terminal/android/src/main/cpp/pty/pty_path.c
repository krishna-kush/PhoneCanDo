// PATH lookup done in the parent before fork, so the child only has to
// execve a finished path. Same idea as execvp, with two differences: the
// search uses the child's PATH, and only absolute PATH entries count (a
// relative or empty entry would resolve against a cwd that changes in the
// child).
#include "pty_path.h"

#include <errno.h>
#include <paths.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

static const char *env_value(char *const envp[], const char *key) {
  size_t klen = strlen(key);
  for (size_t i = 0; envp[i]; i++) {
    if (strncmp(envp[i], key, klen) == 0 && envp[i][klen] == '=') return envp[i] + klen + 1;
  }
  return NULL;
}

int pty_find_program(const char *name, char *const envp[], char *buf, size_t size,
                     const char **path) {
  if (!name || !name[0]) return ENOENT;
  if (strchr(name, '/')) {
    *path = name;
    return 0;
  }
  const char *search = env_value(envp, "PATH");
  if (!search) search = _PATH_DEFPATH;
  size_t nlen = strlen(name);
  int err = ENOENT;
  const char *p = search;
  for (;;) {
    const char *end = strchr(p, ':');
    if (!end) end = p + strlen(p);
    size_t dlen = (size_t)(end - p);
    if (dlen > 0 && p[0] == '/' && dlen + 1 + nlen < size) {
      memcpy(buf, p, dlen);
      buf[dlen] = '/';
      memcpy(buf + dlen + 1, name, nlen + 1);
      struct stat st;
      if (stat(buf, &st) == 0 && S_ISREG(st.st_mode)) {
        if (access(buf, X_OK) == 0) {
          *path = buf;
          return 0;
        }
        err = EACCES;  // like execvp: report it only if nothing later fits
      }
    }
    if (!*end) return err;
    p = end + 1;
  }
}
