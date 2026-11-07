package com.phonecando.lre.oci.registry

import com.phonecando.lre.oci.ref.ImageRef

/**
 * A registry that carries copies of Docker Hub's official (`library/<name>`)
 * images under [repositoryPrefix] + name.
 */
data class Mirror(val host: String, val repositoryPrefix: String)

/**
 * Where Docker Hub official images can also come from when Docker Hub
 * refuses (429: its anonymous limit is about 10 pulls per hour per IP, so
 * this is normal), fails (5xx) or is unreachable. Digests make every copy
 * as good as the original. Other images have no mirrors.
 */
class Mirrors(val dockerHubLibrary: List<Mirror>) {
    /** The image's own registry first, then the mirrors that carry it. */
    internal fun sourcesFor(ref: ImageRef): List<RegistrySource> {
        val primary = RegistrySource(ref.scheme, ref.registry, ref.repository, primary = true)
        val name = ref.repository.removePrefix(LIBRARY)
        if (!ref.isDockerHub || !ref.repository.startsWith(LIBRARY) || name.contains('/')) return listOf(primary)
        return listOf(primary) + dockerHubLibrary.map {
            RegistrySource("https", it.host, it.repositoryPrefix + name, primary = false)
        }
    }

    companion object {
        private const val LIBRARY = "library/"

        /** AWS's public gallery copy of Docker official images, then Google's Hub cache. */
        val default = Mirrors(
            listOf(
                Mirror("public.ecr.aws", "docker/library/"),
                Mirror("mirror.gcr.io", "library/"),
            ),
        )

        /** Docker Hub only. */
        val NONE = Mirrors(emptyList())
    }
}
