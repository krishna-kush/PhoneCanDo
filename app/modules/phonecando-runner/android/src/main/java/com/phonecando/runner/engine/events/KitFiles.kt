package com.phonecando.runner.engine.events

import com.phonecando.runner.agents.AssetTree
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.nio.file.attribute.PosixFilePermissions

// The kit's scripts and the events file in a TUI engine's HOME. On every
// start (EngineLauncher.plan) the scripts come from the assets
// (agents/kit/scripts/, packaged by agents.gradle) into .phonecando/bin/,
// mode 755, each replaced whole so a script that is running keeps its old
// copy; and the events file is emptied, so the event sink (EventFileTail)
// reads only this engine life's lines. An image binds HOME at its own path
// in the guest, so these host paths are the guest's too (PHONECANDO_EVENTS,
// and BROWSER for an image kind that sets none: phonecando-open, so a
// program's sign-in page becomes an open_url prompt). Pure JVM over an
// AssetTree.
internal object KitFiles {
  const val ASSETS = "agents/kit/scripts"
  const val BIN = ".phonecando/bin"
  const val EVENTS = ".phonecando/events"
  private const val OPEN = "phonecando-open"

  private val MODE = PosixFilePermissions.fromString("rwxr-xr-x")

  fun events(home: File) = File(home, EVENTS)

  /** The script that hands a link to the phone (`phonecando-open <url>`). */
  fun opener(home: File) = File(home, "$BIN/$OPEN")

  fun prepare(assets: AssetTree, home: File) {
    val bin = File(home, BIN).apply { mkdirs() }
    for (name in assets.list(ASSETS).orEmpty()) {
      val tmp = File(bin, "$name.tmp")
      assets.open("$ASSETS/$name").use { inp -> tmp.outputStream().use { inp.copyTo(it) } }
      Files.setPosixFilePermissions(tmp.toPath(), MODE)
      Files.move(tmp.toPath(), File(bin, name).toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
    }
    events(home).writeBytes(ByteArray(0))
  }
}
