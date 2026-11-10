package com.phonecando.lme.catalog.hub

/** The `rel="next"` target of an HTTP `Link` header, kept only when it is a Hub URL. Pure. */
internal object Links {
    private val ENTRY = Regex("""<([^>]*)>\s*((?:;\s*[^;,]*)*)""")
    private val NEXT = Regex("""(?i);\s*rel\s*=\s*"?next"?""")

    fun next(header: String?): String? {
        if (header == null) return null
        return ENTRY.findAll(header)
            .firstOrNull { NEXT.containsMatchIn(it.groupValues[2]) }
            ?.groupValues?.get(1)
            ?.takeIf { HubUrls.isHub(it) }
    }
}
