package com.phonecando.terminal

internal object PhoneCanDoPty {
  init {
    System.loadLibrary("phonecando_pty")
  }

  external fun openPty(cmd: Array<String>, envPairs: Array<String>, cwd: String, rows: Int, cols: Int): Int
  external fun readPty(fd: Int, buf: ByteArray, len: Int): Int
  external fun writePty(fd: Int, buf: ByteArray, len: Int): Int
  external fun setWinSize(fd: Int, rows: Int, cols: Int)
  external fun closePty(fd: Int)
}
