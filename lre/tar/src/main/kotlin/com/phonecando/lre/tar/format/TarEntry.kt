package com.phonecando.lre.tar.format

import java.nio.file.attribute.FileTime

internal enum class EntryKind {
    FILE,
    DIR,
    SYMLINK,
    HARDLINK,

    /** Character and block devices and FIFOs: never created. */
    SPECIAL,

    /** Member types we don't know (volume labels, old GNU extras): skipped. */
    UNKNOWN,
}

/** One archive member with GNU long names and PAX overrides folded in. */
internal class TarEntry(
    val name: String,
    val kind: EntryKind,
    /** Symlink target (verbatim) or hard-link target (an archive path). */
    val linkName: String,
    /** Bytes of data that follow; 0 for header-only kinds. */
    val size: Long,
    val mode: Int,
    val mtime: FileTime,
)
