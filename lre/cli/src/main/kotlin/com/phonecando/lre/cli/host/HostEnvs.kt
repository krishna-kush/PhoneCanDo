package com.phonecando.lre.cli.host

import com.phonecando.lre.api.HostEnv
import java.io.File

/**
 * HostEnv for a CI host, from resolved paths and what we read off the host.
 * Pure: the caller reads resolv.conf and PATH.
 *
 * - libDir: the dir with libproot.so, libproot-loader.so and
 *   libphonecando_launch.so, built for glibc (the APK's native-lib dir on
 *   the phone; same file names).
 * - dataDirSpellings: the given spellings, else the image dir's parent
 *   (one spelling: a CI host has no /data/data alias).
 * - dnsServers: resolv.conf's nameservers; none means the runtime's public fallback.
 * - hostPath: our PATH, appended after shims/ in engine.env as Android's is.
 */
object HostEnvs {
    fun of(libDir: File, imageDir: File, dataDirs: List<String>, resolvConf: String?, path: String?): HostEnv =
        HostEnv(
            libDir = libDir.path,
            dataDirSpellings = dataDirs.ifEmpty { listOf(imageDir.parentFile?.path ?: "/") },
            dnsServers = resolvConf?.let(ResolvConf::nameservers).orEmpty(),
            hostPath = path.orEmpty(),
        )
}
