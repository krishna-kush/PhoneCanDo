package com.phonecando.lme.catalog.hub

import com.phonecando.lme.api.LmeException

/** Repository ids, commit shas and file paths, checked before they reach a URL. Pure. */
object HubNames {
    private const val MAX_PART = 96
    private val PART = Regex("[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?")
    private val SHA = Regex("[0-9a-f]{40}")

    fun isRepo(input: String): Boolean {
        val parts = input.split('/')
        return parts.size == 2 && parts.all { it.length <= MAX_PART && PART.matches(it) && "--" !in it && ".." !in it }
    }

    /** `owner/name` as Hugging Face allows it, trimmed. @throws LmeException.InvalidName otherwise. */
    fun repo(input: String): String {
        val trimmed = input.trim()
        if (!isRepo(trimmed)) throw LmeException.InvalidName(input, "a repository is owner/name: letters, digits, '.', '_' and '-'")
        return trimmed
    }

    fun isSha(input: String): Boolean = SHA.matches(input)

    /** A full commit sha. @throws LmeException.InvalidName otherwise. */
    fun sha(input: String): String {
        if (!isSha(input)) throw LmeException.InvalidName(input, "a revision here is a full 40-character commit sha")
        return input
    }

    /**
     * True for a relative path made of plain segments: no `.` or `..`, no
     * empty segment, no backslash or control character. Listings are
     * untrusted; a file with any other path is not offered.
     */
    fun isPlainPath(path: String): Boolean =
        path.isNotEmpty() && path.length <= 1024 &&
            path.none { it == '\\' || it.code < 0x20 || it.code == 0x7f } &&
            path.split('/').all { it.isNotEmpty() && it != "." && it != ".." }
}
