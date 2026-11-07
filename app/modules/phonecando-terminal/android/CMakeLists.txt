cmake_minimum_required(VERSION 3.22.1)
project(phonecando_pty C)

# forkpty.c is the JNI glue; pty/ is the plain POSIX core the host test
# (src/test/c/) builds as well.
add_library(phonecando_pty SHARED
  src/main/cpp/forkpty.c
  src/main/cpp/pty/pty_spawn.c
  src/main/cpp/pty/pty_path.c
  src/main/cpp/pty/pty_child.c
  src/main/cpp/pty/pty_io.c
)
target_include_directories(phonecando_pty PRIVATE src/main/cpp/pty)
# Only the JNIEXPORT entry points leave the library.
target_compile_options(phonecando_pty PRIVATE -Wall -Wextra -fvisibility=hidden)
# 16 KB page devices: align every LOAD segment to 16 KB (NDK 27 defaults to
# 4 KB). Check with `readelf -lW libphonecando_pty.so`: Align >= 0x4000.
target_link_options(phonecando_pty PRIVATE "-Wl,-z,max-page-size=16384")
