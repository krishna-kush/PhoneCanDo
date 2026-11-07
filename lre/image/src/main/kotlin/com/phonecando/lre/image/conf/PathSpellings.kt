package com.phonecando.lre.image.conf

/**
 * One host path under every spelling of the app's data dir. Inside the app
 * process getcwd() says `/data/data/<pkg>/...` while Context.filesDir says
 * `/data/user/0/<pkg>/...`; home/ and tmp/ are bound and listed under each,
 * so a command keeps its project folder whichever spelling its cwd has. Pure.
 */
internal object PathSpellings {
    /** [path] under each of [spellings] (canonical first), or [path] alone when it is under none. */
    fun of(path: String, spellings: List<String>): List<String> {
        val base = spellings.firstOrNull { under(path, it) } ?: return listOf(path)
        val rest = path.substring(base.trimEnd('/').length)
        return spellings.map { it.trimEnd('/') + rest }.distinct()
    }

    /** [path] equals [root] or lies under it, compared by whole components. */
    fun under(path: String, root: String): Boolean {
        val r = root.trimEnd('/')
        if (r.isEmpty()) return path.startsWith("/")
        return path == r || path.startsWith("$r/")
    }
}
