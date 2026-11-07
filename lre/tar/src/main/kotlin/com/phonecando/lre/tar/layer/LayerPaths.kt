package com.phonecando.lre.tar.layer

/**
 * Real guest paths (slash-joined, after symlink resolution) this layer has
 * created so far, so whiteouts and opaque dirs only remove what lower layers
 * left: tar order is arbitrary, a marker may come after this layer's own
 * entries in the same dir.
 */
internal class LayerPaths {
    private val written = HashSet<String>()
    private val ancestors = HashSet<String>()

    fun add(key: String) {
        written += key
        var slash = key.lastIndexOf('/')
        // An ancestor already present has all of its own ancestors present too.
        while (slash > 0 && ancestors.add(key.substring(0, slash))) slash = key.lastIndexOf('/', slash - 1)
    }

    /** This layer wrote [key] itself or something below it. */
    fun touched(key: String): Boolean = key in written || key in ancestors
}
