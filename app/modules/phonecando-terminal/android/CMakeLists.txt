cmake_minimum_required(VERSION 3.22.1)
project(phonecando_pty)

add_library(phonecando_pty SHARED src/main/cpp/forkpty.c)

find_library(log-lib log)
target_link_libraries(phonecando_pty ${log-lib})
