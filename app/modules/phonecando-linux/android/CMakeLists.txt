cmake_minimum_required(VERSION 3.22.1)
project(phonecando_linux C)

# The launcher every guest command goes through (lre/launcher). The play
# flavor passes -DPHONECANDO_LINUX=OFF (build.gradle): no Linux there.
option(PHONECANDO_LINUX "Build the Linux image launcher" ON)

if(PHONECANDO_LINUX)
  set(LAUNCHER_SRC ${CMAKE_CURRENT_SOURCE_DIR}/../../../../lre/launcher/src)
  add_executable(phonecando_launch
    ${LAUNCHER_SRC}/conf.c
    ${LAUNCHER_SRC}/plan.c
    ${LAUNCHER_SRC}/relay.c
    ${LAUNCHER_SRC}/die.c
    ${LAUNCHER_SRC}/standin.c
    ${LAUNCHER_SRC}/main.c)
  # An executable with a library's name: AGP packages only lib*.so files.
  set_target_properties(phonecando_launch PROPERTIES
    OUTPUT_NAME libphonecando_launch.so
    C_STANDARD 11
    C_STANDARD_REQUIRED ON
    C_EXTENSIONS OFF)
  target_compile_options(phonecando_launch PRIVATE -Wall -Wextra -Werror)
  # 16 KB pages (Android 15+ devices): every LOAD segment 16 KB aligned.
  target_link_options(phonecando_launch PRIVATE -Wl,-z,max-page-size=16384)
endif()
