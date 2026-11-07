package com.phonecando.lre.image.family

/**
 * Turns a manual-package listing into package names safe to put on a shell
 * line: anything that is not a plain name is dropped, never quoted. Pure.
 */
internal object PackageLists {
    private val SAFE = Regex("[A-Za-z0-9][A-Za-z0-9@._+:-]*")
    private val XBPS_VERSION = Regex("-[^-]*_[0-9]+$")
    private val APK_CONSTRAINT = Regex("[<>=~].*$")

    fun parse(format: ListFormat, text: String): List<String> {
        val names = when (format) {
            ListFormat.LINES -> lines(text.replace("\\n", "\n"))
            ListFormat.APK_WORLD -> lines(text).map { it.replace(APK_CONSTRAINT, "") }
            ListFormat.ZYPPER_TABLE -> zypperNames(text)
            ListFormat.XBPS_PKGVER -> lines(text).map { it.replace(XBPS_VERSION, "") }
        }
        return names.filter(SAFE::matches).distinct()
    }

    private fun lines(text: String): List<String> =
        text.lineSequence().map { it.trim() }.filter { it.isNotEmpty() }.toList()

    private fun zypperNames(text: String): List<String> = lines(text).mapNotNull { line ->
        val cols = line.split('|').map { it.trim() }
        cols.getOrNull(2)?.takeIf { cols.size >= 3 && it != "Name" }
    }
}
