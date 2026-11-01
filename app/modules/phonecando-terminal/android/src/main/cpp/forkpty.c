// Own JNI forkpty implementation (ours). No Termux code: this avoids the
// GPLv3 burden while giving opencode's TUI the real PTY it requires
// (isatty, window size, raw mode). Rendering is done by xterm.js (MIT) in a
// WebView; this file only moves bytes between master fd and Kotlin.
#include <jni.h>
#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <pty.h>
#include <signal.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <termios.h>
#include <unistd.h>

// Last child pid from openPty (single live PTY at a time in the app).
// Needed so setWinSize can send SIGWINCH after TIOCSWINSZ.
static pid_t g_child_pid = -1;

// Puts the slave side into raw mode so the TUI gets keystrokes uncooked.
static void make_raw(int fd) {
  struct termios t;
  if (tcgetattr(fd, &t) != 0) return;
  cfmakeraw(&t);
  tcsetattr(fd, TCSANOW, &t);
}

JNIEXPORT jint JNICALL
Java_com_phonecando_terminal_PhoneCanDoPty_openPty(JNIEnv *env, jclass clazz,
                                         jobjectArray cmd, jobjectArray envPairs,
                                         jstring cwd, jint rows, jint cols) {
  (void)clazz;
  int master = -1;

  jsize argc = (*env)->GetArrayLength(env, cmd);
  char **argv = calloc((size_t)argc + 1, sizeof(char *));
  if (!argv) return -1;
  for (jsize i = 0; i < argc; i++) {
    jstring s = (jstring)(*env)->GetObjectArrayElement(env, cmd, i);
    const char *c = (*env)->GetStringUTFChars(env, s, NULL);
    argv[i] = strdup(c ? c : "");
    (*env)->ReleaseStringUTFChars(env, s, c);
    (*env)->DeleteLocalRef(env, s);
  }

  struct winsize ws;
  memset(&ws, 0, sizeof(ws));
  ws.ws_row = (unsigned short)rows;
  ws.ws_col = (unsigned short)cols;

  pid_t pid = forkpty(&master, NULL, NULL, &ws);
  if (pid < 0) {
    for (jsize i = 0; i < argc; i++) free(argv[i]);
    free(argv);
    return -1;
  }
  if (pid == 0) {
    // Child: apply environment, cwd, raw mode, then exec.
    jsize envc = (*env)->GetArrayLength(env, envPairs);
    for (jsize i = 0; i < envc; i++) {
      jstring s = (jstring)(*env)->GetObjectArrayElement(env, envPairs, i);
      const char *c = (*env)->GetStringUTFChars(env, s, NULL);
      if (c) {
        const char *eq = strchr(c, '=');
        if (eq) {
          char *name = strndup(c, (size_t)(eq - c));
          setenv(name, eq + 1, 1);
          free(name);
        }
      }
      (*env)->ReleaseStringUTFChars(env, s, c);
      (*env)->DeleteLocalRef(env, s);
    }
    const char *dir = (*env)->GetStringUTFChars(env, cwd, NULL);
    if (dir && dir[0]) chdir(dir);
    if (dir) (*env)->ReleaseStringUTFChars(env, cwd, dir);
    make_raw(STDIN_FILENO);
    execvp(argv[0], argv);
    _exit(127);
  }
  for (jsize i = 0; i < argc; i++) free(argv[i]);
  free(argv);
  // Non-blocking master: read() must return immediately so the JS thread
  // (Expo Function is sync JSI) never stalls waiting for TUI output.
  // Missing this = soft keyboard up, onChangeText starved, typing dead.
  {
    int flags = fcntl(master, F_GETFL, 0);
    if (flags >= 0) fcntl(master, F_SETFL, flags | O_NONBLOCK);
  }
  g_child_pid = pid;
  return master;
}

JNIEXPORT jint JNICALL
Java_com_phonecando_terminal_PhoneCanDoPty_readPty(JNIEnv *env, jclass clazz, jint fd,
                                         jbyteArray buf, jint len) {
  (void)clazz;
  jbyte *bytes = (*env)->GetByteArrayElements(env, buf, NULL);
  if (!bytes) return -1;
  ssize_t n = read((int)fd, bytes, (size_t)len);
  if (n < 0) {
    if (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR) n = 0;
  }
  (*env)->ReleaseByteArrayElements(env, buf, bytes, 0);
  return (jint)n;
}

JNIEXPORT jint JNICALL
Java_com_phonecando_terminal_PhoneCanDoPty_writePty(JNIEnv *env, jclass clazz, jint fd,
                                          jbyteArray buf, jint len) {
  (void)clazz;
  jbyte *bytes = (*env)->GetByteArrayElements(env, buf, NULL);
  if (!bytes) return -1;
  ssize_t total = 0;
  while (total < len) {
    ssize_t n = write((int)fd, bytes + total, (size_t)(len - total));
    if (n > 0) {
      total += n;
      continue;
    }
    if (n < 0 && (errno == EAGAIN || errno == EWOULDBLOCK || errno == EINTR)) {
      struct pollfd pfd;
      pfd.fd = (int)fd;
      pfd.events = POLLOUT;
      pfd.revents = 0;
      poll(&pfd, 1, 100);
      continue;
    }
    break;
  }
  (*env)->ReleaseByteArrayElements(env, buf, bytes, JNI_ABORT);
  return (jint)total;
}

JNIEXPORT void JNICALL
Java_com_phonecando_terminal_PhoneCanDoPty_setWinSize(JNIEnv *env, jclass clazz, jint fd,
                                            jint rows, jint cols) {
  (void)env;
  (void)clazz;
  struct winsize ws;
  memset(&ws, 0, sizeof(ws));
  ws.ws_row = (unsigned short)rows;
  ws.ws_col = (unsigned short)cols;
  ioctl((int)fd, TIOCSWINSZ, &ws);
  if (g_child_pid > 0) kill(g_child_pid, SIGWINCH);
}

JNIEXPORT void JNICALL
Java_com_phonecando_terminal_PhoneCanDoPty_closePty(JNIEnv *env, jclass clazz, jint fd) {
  (void)env;
  (void)clazz;
  close((int)fd);
}
