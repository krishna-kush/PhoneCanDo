package com.phonecando.lre.tar.format

import com.phonecando.lre.api.LreException

/** Tar typeflag bytes and what each means to us. */
internal object TypeFlags {
    const val GNU_LONG_NAME = 'L'
    const val GNU_LONG_LINK = 'K'
    const val PAX = 'x'
    const val PAX_GLOBAL = 'g'

    /** Solaris' early PAX flag; same record format as [PAX]. */
    const val PAX_SOLARIS = 'X'

    fun kindOf(type: Char, name: String): EntryKind = when (type) {
        // v7 marked directories only by the trailing slash.
        '0', '\u0000', '7' -> if (name.endsWith('/')) EntryKind.DIR else EntryKind.FILE
        '1' -> EntryKind.HARDLINK
        '2' -> EntryKind.SYMLINK
        '3', '4', '6' -> EntryKind.SPECIAL
        // GNU dumpdir: a directory whose data lists its contents; we skip that data.
        '5', 'D' -> EntryKind.DIR
        'S' -> throw LreException.UnsupportedLayer("tar sparse file")
        'M' -> throw LreException.UnsupportedLayer("tar multi-volume member")
        else -> EntryKind.UNKNOWN
    }

    /** POSIX: links, devices, dirs and FIFOs carry no data whatever their size field says. */
    fun hasData(type: Char): Boolean = type !in "123456"
}
