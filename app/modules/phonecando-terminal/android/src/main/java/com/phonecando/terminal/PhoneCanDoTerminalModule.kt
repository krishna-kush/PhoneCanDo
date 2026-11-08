package com.phonecando.terminal

import android.system.OsConstants
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PhoneCanDoTerminalModule : Module() {
  private val sessions = PtySessions()

  override fun definition() = ModuleDefinition {
    Name("PhoneCanDoTerminal")

    // A JS reload tears the module down without running screen cleanup:
    // hang up every PTY so no TUI keeps running unseen.
    OnDestroy {
      sessions.closeAll()
    }

    Function("getLibDir") {
      appContext.reactContext?.applicationInfo?.nativeLibraryDir
        ?: throw Exception("no application info")
    }

    // Bytes cross the bridge as base64: universally supported, no typed-array risk.
    Function("open") { params: Map<String, Any> ->
      @Suppress("UNCHECKED_CAST")
      val cmd = params["cmd"] as? List<String> ?: throw Exception("cmd required")
      @Suppress("UNCHECKED_CAST")
      val env = params["env"] as? Map<String, String> ?: emptyMap()
      val cwd = params["cwd"] as? String ?: ""
      val rows = (params["rows"] as? Double)?.toInt() ?: 24
      val cols = (params["cols"] as? Double)?.toInt() ?: 80
      // Raw unless asked otherwise: the agent TUIs read every key themselves.
      val raw = params["raw"] as? Boolean ?: true
      val handOver = params["handOver"] as? Boolean ?: false
      sessions.open(cmd, env, cwd, rows, cols, raw, handOver)
    }

    Function("read") { params: Map<String, Any> ->
      val fd = openFd(params)
      val maxBytes = (params["maxBytes"] as? Double)?.toInt() ?: 8192
      val buf = ByteArray(maxBytes)
      val n = PhoneCanDoPty.readPty(fd, buf, maxBytes)
      if (n < 0) throw Exception("pty eof/error")
      Base64.encodeToString(buf, 0, n, Base64.NO_WRAP)
    }

    Function("write") { params: Map<String, Any> ->
      val fd = openFd(params)
      val data = params["data"] as? String ?: throw Exception("data required")
      val bytes = Base64.decode(data, Base64.DEFAULT)
      PhoneCanDoPty.writePty(fd, bytes, bytes.size)
    }

    Function("resize") { params: Map<String, Any> ->
      val fd = openFd(params)
      val rows = (params["rows"] as? Double)?.toInt() ?: 24
      val cols = (params["cols"] as? Double)?.toInt() ?: 80
      PhoneCanDoPty.setWinSize(fd, rows, cols)
      "ok"
    }

    Function("close") { params: Map<String, Any> ->
      val fd = (params["fd"] as? Double)?.toInt() ?: throw Exception("fd required")
      sessions.close(fd)
      "ok"
    }

    // Signals the PTY program's whole process group. False once it has exited.
    Function("kill") { params: Map<String, Any> ->
      val fd = (params["fd"] as? Double)?.toInt() ?: throw Exception("fd required")
      val signal = signalNumber(params["signal"] as? String ?: "SIGTERM")
      sessions.child(fd).kill(signal)
    }

    // { code, signal } once the program has exited and been reaped; null before.
    Function("exitStatus") { params: Map<String, Any> ->
      val fd = (params["fd"] as? Double)?.toInt() ?: throw Exception("fd required")
      val exit = sessions.child(fd).exit ?: return@Function null
      mapOf("code" to exit.code, "signal" to exit.signal)
    }
  }

  // Only fds we opened and haven't closed reach the native calls.
  private fun openFd(params: Map<String, Any>): Int {
    val fd = (params["fd"] as? Double)?.toInt() ?: throw Exception("fd required")
    sessions.child(fd)
    return fd
  }
}

// The signals ptyKill offers (PtySignal in the TS shim), by name: numbers
// differ between architectures, names don't.
private fun signalNumber(name: String): Int = when (name) {
  "SIGTERM" -> OsConstants.SIGTERM
  "SIGKILL" -> OsConstants.SIGKILL
  "SIGINT" -> OsConstants.SIGINT
  "SIGHUP" -> OsConstants.SIGHUP
  else -> throw Exception("unsupported signal: $name")
}
