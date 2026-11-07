package com.phonecando.lre.oci.catalog

/**
 * Picker order for tags: `latest`, then `stable`, then version numbers
 * newest first (a floating `3.24` before `3.24.4`), then everything else in
 * the order Docker Hub sent it (most recently pushed first). Date stamps
 * like `20260805` count as "everything else", not as version 20260805.
 */
internal object TagOrder {
    private val VERSION = Regex("v?\\d+(?:\\.\\d+)*")
    private const val DATE_LIKE_MAJOR = 1000

    fun sort(tags: List<CatalogTag>): List<CatalogTag> =
        tags.withIndex().sortedWith(compareBy<IndexedValue<CatalogTag>> { rank(it.value.name) }
            .thenComparator { a, b -> compareVersions(a.value.name, b.value.name) }
            .thenBy { it.index })
            .map { it.value }

    private fun rank(name: String): Int = when {
        name == "latest" -> 0
        name == "stable" -> 1
        version(name) != null -> 2
        else -> 3
    }

    /** Newest first among versions; zero (keep server order) for anything else. */
    private fun compareVersions(a: String, b: String): Int {
        val va = version(a) ?: return 0
        val vb = version(b) ?: return 0
        for (i in 0 until minOf(va.size, vb.size)) {
            if (va[i] != vb[i]) return vb[i].compareTo(va[i])
        }
        return va.size.compareTo(vb.size)
    }

    private fun version(name: String): List<Long>? {
        if (!VERSION.matches(name)) return null
        val parts = name.removePrefix("v").split('.').map { it.toLongOrNull() ?: return null }
        return parts.takeIf { it.first() < DATE_LIKE_MAJOR }
    }
}
