package com.phonecando.lre.oci.manifest

/** The OCI and Docker media types we read. */
internal object MediaTypes {
    const val OCI_INDEX = "application/vnd.oci.image.index.v1+json"
    const val DOCKER_LIST = "application/vnd.docker.distribution.manifest.list.v2+json"
    const val OCI_MANIFEST = "application/vnd.oci.image.manifest.v1+json"
    const val DOCKER_MANIFEST = "application/vnd.docker.distribution.manifest.v2+json"

    val INDEXES = setOf(OCI_INDEX, DOCKER_LIST)
    val MANIFESTS = setOf(OCI_MANIFEST, DOCKER_MANIFEST)

    /** `Accept` for a manifest GET: multi-arch first, then single-arch. */
    val MANIFEST_ACCEPT = listOf(OCI_INDEX, DOCKER_LIST, OCI_MANIFEST, DOCKER_MANIFEST).joinToString(", ")
}
