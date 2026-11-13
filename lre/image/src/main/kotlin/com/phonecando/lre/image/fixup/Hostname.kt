package com.phonecando.lre.image.fixup

import com.phonecando.lre.api.OsInfo

/**
 * The guest's hostname: its OS's name (`debian`, `alpine`), what prompts,
 * `hostname` and `uname -n` show, unless someone wrote their own into
 * /etc/hostname since we last wrote it there. Pure.
 */
internal object Hostname {
    /** Linux's HOST_NAME_MAX: uname's nodename holds no more. */
    const val MAX_CHARS = 64

    /** When the os-release ID leaves nothing usable. */
    private const val FALLBACK = "linux"
    private const val MAX_LABEL_CHARS = 63

    private val LABEL = Regex("[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?")
    private val NOT_NAME = Regex("[^a-z0-9]+")

    /** [os]'s os-release ID as one hostname label (the ID may also hold `.` and `_`). */
    fun forOs(os: OsInfo): String =
        os.id.lowercase().replace(NOT_NAME, "-").trim('-').take(MAX_LABEL_CHARS).trimEnd('-').ifEmpty { FALLBACK }

    /** The name in an /etc/hostname's [text]: its first line, when that is a valid hostname. */
    fun parse(text: String?): String? {
        val name = text?.lineSequence()?.firstOrNull()?.trim() ?: return null
        val valid = name.length in 1..MAX_CHARS &&
            name.split('.').all { it.length <= MAX_LABEL_CHARS && LABEL.matches(it) }
        return name.takeIf { valid }
    }

    /**
     * The name the guest gets: /etc/hostname's [current] text when it names
     * a valid host other than the one we last wrote ([written]), else [auto].
     * No record means we never wrote one: an image from before, which gets
     * [auto] too.
     */
    fun choose(current: String?, written: String?, auto: String): String {
        val own = parse(current)
        return if (own != null && written != null && own != written) own else auto
    }
}
