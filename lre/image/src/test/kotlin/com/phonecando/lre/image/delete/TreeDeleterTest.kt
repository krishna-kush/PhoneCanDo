package com.phonecando.lre.image.delete

import com.phonecando.lre.api.ImageLayout
import com.phonecando.lre.image.support.Tree
import org.junit.jupiter.api.io.TempDir
import java.io.File
import java.nio.file.Files
import java.nio.file.attribute.PosixFilePermissions
import java.util.concurrent.Executor
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class TreeDeleterTest {
    @TempDir
    lateinit var dir: File

    private fun chmod(file: File, mode: String) = Files.setPosixFilePermissions(file.toPath(), PosixFilePermissions.fromString(mode))

    @Test
    fun `read-only dirs go, symlinks pointing outside are not followed`() {
        val outside = File(dir, "precious").apply { mkdirs() }
        File(outside, "keep.txt").writeText("keep")
        val outsideFile = File(dir, "precious.txt").apply { writeText("keep") }
        val tree = File(dir, "tree")
        Tree(tree)
            .file("a/b/c/file", "x")
            .file("ro/file", "x")
            .file("locked/inner/file", "x")
            .link("a/escape-dir", outside.path)
            .link("a/escape-file", outsideFile.path)
            .link("a/b/dangling", "/no/such/path")
        chmod(File(tree, "ro"), "r-xr-xr-x")
        chmod(File(tree, "locked/inner"), "---------")
        chmod(File(tree, "locked"), "r--------")

        assertTrue(TreeDeleter().delete(tree))

        assertFalse(tree.exists())
        assertEquals("keep", File(outside, "keep.txt").readText())
        assertEquals("keep", outsideFile.readText())
    }

    @Test
    fun `a symlink as the root is removed as a link`() {
        val target = File(dir, "target").apply { mkdirs() }
        File(target, "f").writeText("keep")
        val link = File(dir, "link")
        Files.createSymbolicLink(link.toPath(), target.toPath())
        assertTrue(TreeDeleter().delete(link))
        assertEquals("keep", File(target, "f").readText())
    }

    @Test
    fun `a missing tree is already deleted, a deep one does not overflow`() {
        assertTrue(TreeDeleter().delete(File(dir, "nothing")))
        var deep = File(dir, "deep")
        repeat(300) { deep = File(deep, "d") }
        deep.mkdirs()
        assertTrue(TreeDeleter().delete(File(dir, "deep")))
    }

    @Test
    fun `image delete renames into trash, then deletes in the background`() {
        val images = File(dir, "images")
        val layout = ImageLayout(File(images, "d1"))
        Tree(layout.root).file("rootfs/etc/hosts", "x").file("home/p/main.py", "y")
        chmod(File(layout.root, "rootfs/etc"), "r-x------")
        val queued = ArrayList<Runnable>()

        val entry = ImageDelete().delete(layout, Executor { queued += it })!!

        assertFalse(layout.root.exists())
        assertTrue(entry.isDirectory)
        assertEquals(File(images, ".trash"), entry.parentFile)
        assertEquals(1, queued.size)
        queued.single().run()
        assertFalse(entry.exists())
        assertNull(ImageDelete().delete(layout, Executor { error("nothing to delete") }))
    }

    @Test
    fun `empty trash clears leftovers from a killed delete`() {
        val images = File(dir, "images")
        val layout = ImageLayout(File(images, "d2"))
        Tree(layout.root).file("rootfs/bin/sh", "x")
        ImageDelete().moveToTrash(layout)
        val trash = ImageDelete.trashFor(layout)
        assertEquals(1, trash.list()!!.size)
        assertTrue(ImageDelete().emptyTrash(trash))
        assertEquals(0, trash.list()!!.size)
    }
}
