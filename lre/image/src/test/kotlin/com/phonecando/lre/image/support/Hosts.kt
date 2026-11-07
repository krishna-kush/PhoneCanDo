package com.phonecando.lre.image.support

import com.phonecando.lre.api.HostEnv
import com.phonecando.lre.api.ImageLayout
import java.io.File

/** Host environments and layouts for tests. */
object Hosts {
    const val PKG = "com.phonecando.app"
    const val LIB = "/data/app/~~abc==/com.phonecando.app-xyz==/lib/arm64"

    /** The phone: two spellings of the data dir, canonical first. */
    val phone = HostEnv(
        libDir = LIB,
        dataDirSpellings = listOf("/data/user/0/$PKG", "/data/data/$PKG"),
        dnsServers = listOf("192.168.1.1"),
        hostPath = "/product/bin:/apex/com.android.runtime/bin:/system/bin",
    )

    /** An image layout on the phone, in the canonical spelling. */
    val phoneLayout = ImageLayout(File("/data/user/0/$PKG/files/images/d1"))

    /** A host whose data dir is [dataDir] (one spelling), for tests that touch disk. */
    fun local(dataDir: File, libDir: String = LIB, dns: List<String> = emptyList()) = HostEnv(
        libDir = libDir,
        dataDirSpellings = listOf(dataDir.path),
        dnsServers = dns,
        hostPath = "/system/bin",
    )
}
