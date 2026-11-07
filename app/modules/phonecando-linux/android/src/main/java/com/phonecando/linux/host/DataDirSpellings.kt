package com.phonecando.linux.host

/**
 * Every spelling of the app's data dir, canonical first (HostEnv's
 * dataDirSpellings). For the phone's first user, getcwd() inside the app
 * process says `/data/data/<pkg>` (device-verified) while Context.dataDir
 * says `/data/user/0/<pkg>`; both name one dir. A secondary user has no
 * `/data/data` alias: its data dir (`/data/user/<n>/<pkg>`) is the only
 * spelling, and so is a data dir moved to adoptable storage
 * (`/mnt/expand/<uuid>/user/0/<pkg>`). Pure.
 */
object DataDirSpellings {
  /** Android's uid range per user (UserHandle.PER_USER_RANGE). */
  const val PER_USER_RANGE = 100_000

  fun of(packageName: String, dataDir: String, uid: Int): List<String> {
    val own = dataDir.trimEnd('/')
    val legacy = "/data/data/$packageName"
    val internal = own == "/data/user/0/$packageName" || own == legacy
    val first = if (uid / PER_USER_RANGE == 0 && internal) legacy else null
    return listOfNotNull(first, own).filter { it.isNotEmpty() }.distinct()
  }
}
