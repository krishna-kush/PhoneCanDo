package com.phonecando.lre.image.guest

/** The guest's PATH variable as a list of dirs. Pure. */
internal object GuestPath {
    /** Debian's root PATH: what we use when the image config sets none. */
    const val DEFAULT = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

    /** The absolute dirs of [path], in order, without repeats. */
    fun dirs(path: String): List<String> = path.split(':').filter { it.startsWith("/") }.distinct()
}
