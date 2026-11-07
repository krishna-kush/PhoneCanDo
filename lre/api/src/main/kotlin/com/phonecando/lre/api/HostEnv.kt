package com.phonecando.lre.api

/** What image setup needs to know about the phone (or CI host) side. */
data class HostEnv(
    /** Dir holding [PayloadNames] files: the APK's native-library dir on the phone. */
    val libDir: String,
    /**
     * Every spelling of the app's data dir, canonical first. Inside the app
     * process getcwd() says `/data/data/<pkg>` while Context.filesDir says
     * `/data/user/0/<pkg>`; launch.conf binds and lists both as `same` paths
     * (device-verified on Android 16). On a CI host this is one path.
     */
    val dataDirSpellings: List<String>,
    /** The current network's DNS servers; empty means a public fallback. */
    val dnsServers: List<String>,
    /** Android's default PATH, appended after shims/ in engine.env. */
    val hostPath: String,
)
