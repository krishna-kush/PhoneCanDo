package com.phonecando.lre.image.shim

/** Which guest command names get a shim. Pure. */
internal object ShimNames {
    /** Always present, even before the rootfs has them: the engine's SHELL is shims/bash. */
    val ALWAYS = setOf("bash", "sh")

    private const val MAX_NAME_BYTES = 255

    /**
     * A name we can put on the engine's PATH as a symlink: no path syntax,
     * no hidden files, no whitespace or control characters, and never
     * `lib*.so`, which the launcher reads as its own name (and so as bash).
     */
    fun isSafe(name: String): Boolean =
        name.isNotEmpty() &&
            !name.startsWith(".") &&
            name.none { it == '/' || it.code <= 0x20 || it.code == 0x7f || it.isWhitespace() } &&
            !(name.startsWith("lib") && name.endsWith(".so") && name.length >= 6) &&
            name.toByteArray(Charsets.UTF_8).size <= MAX_NAME_BYTES
}
