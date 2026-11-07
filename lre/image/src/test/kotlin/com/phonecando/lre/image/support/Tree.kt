package com.phonecando.lre.image.support

import java.io.File
import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.attribute.PosixFilePermissions

/** Builds a synthetic directory tree (a fake rootfs) for tests. */
class Tree(val root: File) {
    fun dir(path: String): Tree = apply { Files.createDirectories(at(path).toPath()) }

    fun file(path: String, text: String = "", mode: String = "rw-r--r--"): Tree = apply {
        val f = at(path)
        Files.createDirectories(f.parentFile.toPath())
        f.writeText(text)
        Files.setPosixFilePermissions(f.toPath(), PosixFilePermissions.fromString(mode))
    }

    fun exe(path: String): Tree = file(path, "#!/bin/sh\n", "rwxr-xr-x")

    fun link(path: String, target: String): Tree = apply {
        val f = at(path)
        Files.createDirectories(f.parentFile.toPath())
        Files.createSymbolicLink(f.toPath(), Paths.get(target))
    }

    fun at(path: String): File = File(root, path.trimStart('/'))
}
