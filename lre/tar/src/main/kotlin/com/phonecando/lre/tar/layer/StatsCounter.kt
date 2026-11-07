package com.phonecando.lre.tar.layer

import com.phonecando.lre.tar.ExtractStats

internal class StatsCounter {
    var entries = 0
    var files = 0
    var dirs = 0
    var symlinks = 0
    var hardlinksCopied = 0
    var whiteouts = 0
    var skipped = 0
    var bytes = 0L

    fun snapshot() = ExtractStats(files, dirs, symlinks, hardlinksCopied, whiteouts, skipped, bytes)
}
