package com.phonecando.lre.cli.host

import com.phonecando.lre.api.HostEnv
import com.phonecando.lre.api.PayloadNames
import com.phonecando.lre.cli.args.HostArgs
import com.phonecando.lre.cli.args.UsageError
import java.io.File
import java.io.IOException
import java.nio.file.Files

/** Paths and host facts from the real filesystem: the IO side of [HostEnvs]. */
object HostPaths {
    private const val RESOLV_CONF = "/etc/resolv.conf"

    /**
     * The image dir, created when missing, as its physical path: the launcher
     * compares `same` paths with getcwd(), which never shows a symlink.
     */
    fun imageDir(path: String): File {
        val dir = File(path).absoluteFile
        try {
            Files.createDirectories(dir.toPath())
        } catch (e: IOException) {
            throw UsageError("cannot create --image-dir $path: ${e.message}")
        }
        return dir.toPath().toRealPath().toFile()
    }

    /** An existing image dir, as its physical path. */
    fun existingImageDir(path: String): File {
        val dir = File(path)
        if (!dir.isDirectory) throw UsageError("--image-dir $path is not a directory")
        return dir.toPath().toRealPath().toFile()
    }

    /** The lib dir as its physical path; warns on [warn] for each payload file it lacks. */
    fun libDir(path: String, warn: (String) -> Unit): File {
        val dir = File(path)
        if (!dir.isDirectory) throw UsageError("--lib-dir $path is not a directory")
        val real = dir.toPath().toRealPath().toFile()
        listOf(PayloadNames.PROOT, PayloadNames.LOADER, PayloadNames.LAUNCHER)
            .filterNot { File(real, it).isFile }
            .forEach { warn("warning: --lib-dir has no $it; commands through the shims will fail") }
        return real
    }

    /** Data-dir spellings as given, made absolute and normalized but never resolved: one may be an alias. */
    fun dataDirs(paths: List<String>): List<String> = paths.map { File(it).absoluteFile.normalize().path }

    /** HostEnv for [args] on this host. */
    fun hostEnv(args: HostArgs, imageDir: File, warn: (String) -> Unit): HostEnv = HostEnvs.of(
        libDir = libDir(args.libDir, warn),
        imageDir = imageDir,
        dataDirs = dataDirs(args.dataDirs),
        resolvConf = File(RESOLV_CONF).takeIf { it.canRead() }?.readText(),
        path = System.getenv("PATH"),
    )
}
