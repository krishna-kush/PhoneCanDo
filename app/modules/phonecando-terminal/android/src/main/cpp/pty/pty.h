// Plain POSIX pseudo-terminal core (ours, clean-room): start a program on a
// PTY, move bytes, resize, signal and reap it. No JNI in here, so the same
// files build into the Android library and into the host test under
// src/test/c/. Every call returns 0 or an errno value unless noted.
#ifndef PHONECANDO_PTY_H
#define PHONECANDO_PTY_H

#include <stddef.h>
#include <sys/types.h>

// What to run. The strings belong to the caller and only need to live for
// the pty_spawn call.
typedef struct {
  char *const *argv;   // NULL-terminated; a bare argv[0] is looked up on PATH
  char *const *envp;   // NULL-terminated; the child's entire environment
  const char *cwd;     // NULL or "" keeps our working directory
  unsigned short rows;
  unsigned short cols;
  // 0: raw slave, for a full-screen program that reads every key itself (a
  // TUI). 1: the tty's cooked defaults (echo, line editing), for a shell:
  // readline only echoes what you type when the tty it starts on echoes.
  int cooked;
  // 0: the slave becomes the controlling terminal of the program's new
  // session. 1: it stays no session's, for a program that hands it on to a
  // child of its own (our Linux launcher: the guest shell takes it, so the
  // hangup when the terminal closes reaches the shell, as on a PC). Android
  // doesn't let an app give up a terminal it holds (TIOCNOTTY).
  int hand_over;
} pty_spec;

typedef struct {
  int master;  // non-blocking, close-on-exec
  pid_t pid;   // session leader, so also its own process group id
} pty_child;

// Where a failed spawn stopped.
typedef enum {
  PTY_STAGE_LOOKUP = 1,  // bad spec, or argv[0] not found on PATH
  PTY_STAGE_OPEN,        // PTY pair or error pipe
  PTY_STAGE_FORK,
  PTY_STAGE_SESSION,     // child: new session, controlling tty, stdio
  PTY_STAGE_CHDIR,
  PTY_STAGE_EXEC,
} pty_stage;

// How a child ended: an exit code, or the signal that killed it.
typedef struct {
  int code;    // -1 when a signal ended it
  int signal;  // 0 when it exited normally
} pty_exit;

// Starts spec->argv on a new PTY. On failure nothing is left behind: no fd,
// no zombie, and *stage says what failed.
int pty_spawn(const pty_spec *spec, pty_child *out, pty_stage *stage);
const char *pty_stage_name(pty_stage stage);

// Blocks until pid has exited but leaves it unreaped, so its pid (and its
// process group id) can't be recycled while we may still signal it.
int pty_await_exit(pid_t pid);
// Collects exactly this pid. We never wait on -1 or 0: that could steal exit
// statuses from Java's own process reaper.
int pty_reap(pid_t pid, pty_exit *out);
// Signals the child's whole process group.
int pty_kill(pid_t pid, int sig);

// Returns bytes read, 0 when nothing is waiting, or -1 (errno set) once the
// child side is gone (EIO) or on error.
ssize_t pty_read(int master, void *buf, size_t len);
// Waits up to timeout_ms (-1: no limit) until a read won't block: bytes are
// waiting, or the child side is gone and the read reports that. Returns 1
// then, 0 on timeout or a signal, or -1 (errno set) on error, EBADF for an fd
// that isn't open.
int pty_wait_readable(int master, int timeout_ms);
// Writes as much as the child takes; gives up after about a second without
// progress so a stuck child can't freeze the caller. Returns bytes written.
size_t pty_write_all(int master, const void *buf, size_t len);
// Sets the window size; the child's foreground process group gets SIGWINCH.
int pty_resize(int master, unsigned short rows, unsigned short cols);

#endif
