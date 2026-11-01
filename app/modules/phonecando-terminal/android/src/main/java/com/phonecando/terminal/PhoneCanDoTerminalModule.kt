package com.phonecando.terminal

import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PhoneCanDoTerminalModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PhoneCanDoTerminal")

    Function("getLibDir") {
      appContext.reactContext?.applicationInfo?.nativeLibraryDir
        ?: throw Exception("no application info")
    }

    // Bytes cross the bridge as base64: universally supported, no typed-array risk.
    Function("open") { params: Map<String, Any> ->
      @Suppress("UNCHECKED_CAST")
      val cmd = (params["cmd"] as? List<String>)?.toTypedArray() ?: throw Exception("cmd required")
      @Suppress("UNCHECKED_CAST")
      val envMap = params["env"] as? Map<String, String> ?: emptyMap()
      val envPairs = envMap.map { (k, v) -> "$k=$v" }.toTypedArray()
      val cwd = params["cwd"] as? String ?: ""
      val rows = (params["rows"] as? Double)?.toInt() ?: 24
      val cols = (params["cols"] as? Double)?.toInt() ?: 80
      val fd = PhoneCanDoPty.openPty(cmd, envPairs, cwd, rows, cols)
      if (fd < 0) throw Exception("forkpty failed")
      fd
    }

    Function("read") { params: Map<String, Any> ->
      val fd = (params["fd"] as? Double)?.toInt() ?: throw Exception("fd required")
      val maxBytes = (params["maxBytes"] as? Double)?.toInt() ?: 8192
      val buf = ByteArray(maxBytes)
      val n = PhoneCanDoPty.readPty(fd, buf, maxBytes)
      if (n < 0) throw Exception("pty eof/error")
      Base64.encodeToString(buf, 0, n, Base64.NO_WRAP)
    }

    Function("write") { params: Map<String, Any> ->
      val fd = (params["fd"] as? Double)?.toInt() ?: throw Exception("fd required")
      val data = params["data"] as? String ?: throw Exception("data required")
      val bytes = Base64.decode(data, Base64.DEFAULT)
      PhoneCanDoPty.writePty(fd, bytes, bytes.size)
    }

    Function("resize") { params: Map<String, Any> ->
      val fd = (params["fd"] as? Double)?.toInt() ?: throw Exception("fd required")
      val rows = (params["rows"] as? Double)?.toInt() ?: 24
      val cols = (params["cols"] as? Double)?.toInt() ?: 80
      PhoneCanDoPty.setWinSize(fd, rows, cols)
      "ok"
    }

    Function("close") { params: Map<String, Any> ->
      val fd = (params["fd"] as? Double)?.toInt() ?: throw Exception("fd required")
      PhoneCanDoPty.closePty(fd)
      "ok"
    }
  }
}
