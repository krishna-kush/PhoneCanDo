package com.phonecando.linux.images

import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.nio.file.attribute.BasicFileAttributes

/**
 * Bytes under a dir: every regular file's size, a symlink counted as a
 * link and never followed (an image is full of links to `/`-rooted guest
 * paths that mean host paths here). Iterative; unreadable entries count 0.
 * Pure JVM.
 */
object DirSize {
  fun of(root: File): Long {
    var total = 0L
    val stack = ArrayDeque<Path>()
    stack.addLast(root.toPath())
    while (stack.isNotEmpty()) {
      val path = stack.removeLast()
      val attrs = try {
        Files.readAttributes(path, BasicFileAttributes::class.java, LinkOption.NOFOLLOW_LINKS)
      } catch (_: IOException) {
        continue
      }
      when {
        attrs.isDirectory -> try {
          Files.newDirectoryStream(path).use { children -> children.forEach(stack::addLast) }
        } catch (_: IOException) {
          // Unreadable dir: what we could not list counts 0.
        }
        attrs.isRegularFile || attrs.isSymbolicLink -> total += attrs.size()
      }
    }
    return total
  }
}
