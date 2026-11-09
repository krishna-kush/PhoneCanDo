// JNI glue for our own PTY (ours; no Termux code: this avoids the GPLv3
// burden while giving opencode's TUI the real PTY it requires — isatty,
// window size, raw mode). Rendering is done by xterm.js (MIT) in a WebView.
// This file only converts between Java and C; the POSIX work, fork included,
// lives in pty/ and is covered by the host test in src/test/c/.
#include <jni.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include "pty.h"

static void throw_io(JNIEnv *env, const char *what, const char *subject, int err) {
  char msg[512];
  snprintf(msg, sizeof msg, "pty %s%s%s: %s", what, subject ? " " : "", subject ? subject : "",
           strerror(err));
  jclass cls = (*env)->FindClass(env, "java/io/IOException");
  if (cls) (*env)->ThrowNew(env, cls, msg);
}

// Strings arrive as UTF-8 byte arrays, not jstrings: JNI's own conversion is
// "modified UTF-8", which mangles emoji and other non-BMP characters in paths.
static char *copy_bytes(JNIEnv *env, jbyteArray bytes) {
  jsize len = (*env)->GetArrayLength(env, bytes);
  char *s = malloc((size_t)len + 1);
  if (!s) return NULL;
  (*env)->GetByteArrayRegion(env, bytes, 0, len, (jbyte *)s);
  s[len] = '\0';
  return s;
}

static void free_strings(char **v) {
  if (!v) return;
  for (size_t i = 0; v[i]; i++) free(v[i]);
  free(v);
}

// byte[][] -> NULL-terminated char*[]; NULL when out of memory.
static char **copy_strings(JNIEnv *env, jobjectArray arr) {
  jsize n = (*env)->GetArrayLength(env, arr);
  char **v = calloc((size_t)n + 1, sizeof(char *));
  if (!v) return NULL;
  for (jsize i = 0; i < n; i++) {
    jbyteArray item = (jbyteArray)(*env)->GetObjectArrayElement(env, arr, i);
    v[i] = copy_bytes(env, item);
    (*env)->DeleteLocalRef(env, item);
    if (!v[i]) {
      free_strings(v);
      return NULL;
    }
  }
  return v;
}

// Returns {masterFd, pid}, or throws IOException naming the failed step.
JNIEXPORT jintArray JNICALL
Java_com_phonecando_terminal_PhoneCanDoPty_openPty(JNIEnv *env, jclass clazz, jobjectArray cmd,
                                                   jobjectArray envPairs, jbyteArray cwd,
                                                   jint rows, jint cols, jboolean raw,
                                                   jboolean handOver) {
  (void)clazz;
  char **argv = copy_strings(env, cmd);
  char **envp = copy_strings(env, envPairs);
  char *dir = copy_bytes(env, cwd);
  jintArray result = NULL;
  if (!argv || !envp || !dir) {
    throw_io(env, "open", NULL, ENOMEM);
    goto done;
  }
  pty_spec spec = {
      .argv = argv,
      .envp = envp,
      .cwd = dir,
      .rows = (unsigned short)rows,
      .cols = (unsigned short)cols,
      .cooked = raw ? 0 : 1,
      .hand_over = handOver ? 1 : 0,
  };
  pty_child child;
  pty_stage stage;
  int err = pty_spawn(&spec, &child, &stage);
  if (err) {
    const char *subject = stage == PTY_STAGE_CHDIR ? dir
                          : stage == PTY_STAGE_LOOKUP || stage == PTY_STAGE_EXEC ? argv[0]
                                                                                 : NULL;
    throw_io(env, pty_stage_name(stage), subject, err);
    goto done;
  }
  jint vals[2] = {child.master, child.pid};
  result = (*env)->NewIntArray(env, 2);
  if (result) (*env)->SetIntArrayRegion(env, result, 0, 2, vals);

done:
  free_strings(argv);
  free_strings(envp);
  free(dir);
  return result;
}

JNIEXPORT jint JNICALL
Java_com_phonecando_terminal_PhoneCanDoPty_readPty(JNIEnv *env, jclass clazz, jint fd,
                                                   jbyteArray buf, jint len) {
  (void)clazz;
  jsize cap = (*env)->GetArrayLength(env, buf);
  if (len > cap) len = cap;
  jbyte *bytes = (*env)->GetByteArrayElements(env, buf, NULL);
  if (!bytes) return -1;
  ssize_t n = pty_read((int)fd, bytes, (size_t)len);
  (*env)->ReleaseByteArrayElements(env, buf, bytes, 0);
  return (jint)n;
}

// 1 once a read won't block, 0 on timeout, -1 on error (as pty_wait_readable).
JNIEXPORT jint JNICALL
Java_com_phonecando_terminal_PhoneCanDoPty_waitReadable(JNIEnv *env, jclass clazz, jint fd,
                                                        jint timeoutMs) {
  (void)env;
  (void)clazz;
  return (jint)pty_wait_readable((int)fd, (int)timeoutMs);
}

JNIEXPORT jint JNICALL
Java_com_phonecando_terminal_PhoneCanDoPty_writePty(JNIEnv *env, jclass clazz, jint fd,
                                                    jbyteArray buf, jint len) {
  (void)clazz;
  jsize cap = (*env)->GetArrayLength(env, buf);
  if (len > cap) len = cap;
  jbyte *bytes = (*env)->GetByteArrayElements(env, buf, NULL);
  if (!bytes) return -1;
  size_t total = pty_write_all((int)fd, bytes, (size_t)len);
  (*env)->ReleaseByteArrayElements(env, buf, bytes, JNI_ABORT);
  return (jint)total;
}

JNIEXPORT void JNICALL
Java_com_phonecando_terminal_PhoneCanDoPty_setWinSize(JNIEnv *env, jclass clazz, jint fd,
                                                      jint rows, jint cols) {
  (void)clazz;
  int err = pty_resize((int)fd, (unsigned short)rows, (unsigned short)cols);
  if (err) throw_io(env, "resize", NULL, err);
}

JNIEXPORT void JNICALL
Java_com_phonecando_terminal_PhoneCanDoPty_closePty(JNIEnv *env, jclass clazz, jint fd) {
  (void)env;
  (void)clazz;
  close((int)fd);
}

JNIEXPORT void JNICALL
Java_com_phonecando_terminal_PhoneCanDoPty_awaitExit(JNIEnv *env, jclass clazz, jint pid) {
  (void)clazz;
  int err = pty_await_exit((pid_t)pid);
  if (err) throw_io(env, "wait", NULL, err);
}

// Returns {code, signal} as in pty_exit.
JNIEXPORT jintArray JNICALL
Java_com_phonecando_terminal_PhoneCanDoPty_reap(JNIEnv *env, jclass clazz, jint pid) {
  (void)clazz;
  pty_exit e;
  int err = pty_reap((pid_t)pid, &e);
  if (err) {
    throw_io(env, "reap", NULL, err);
    return NULL;
  }
  jint vals[2] = {e.code, e.signal};
  jintArray result = (*env)->NewIntArray(env, 2);
  if (result) (*env)->SetIntArrayRegion(env, result, 0, 2, vals);
  return result;
}

JNIEXPORT void JNICALL
Java_com_phonecando_terminal_PhoneCanDoPty_killGroup(JNIEnv *env, jclass clazz, jint pid,
                                                     jint sig) {
  (void)clazz;
  int err = pty_kill((pid_t)pid, (int)sig);
  if (err && err != ESRCH) throw_io(env, "kill", NULL, err);
}
