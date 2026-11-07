package com.phonecando.lre.oci.manifest

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** A content descriptor: in an index (with [platform]) or a manifest (config, layers). */
@Serializable
internal data class Descriptor(
    val mediaType: String? = null,
    val digest: String,
    val size: Long,
    val platform: Platform? = null,
    /** Set on foreign layers that live outside the registry. */
    val urls: List<String>? = null,
)

@Serializable
internal data class Platform(
    val architecture: String? = null,
    val os: String? = null,
    val variant: String? = null,
)

/** An index / manifest list or an image manifest; [Manifest.parse] tells them apart. */
@Serializable
internal data class ManifestDoc(
    val mediaType: String? = null,
    val manifests: List<Descriptor>? = null,
    val config: Descriptor? = null,
    val layers: List<Descriptor>? = null,
)

/** The image config blob (Docker and OCI share this shape). */
@Serializable
internal data class ConfigDoc(
    val architecture: String? = null,
    val os: String? = null,
    val variant: String? = null,
    val config: RuntimeDoc? = null,
)

@Serializable
internal data class RuntimeDoc(
    @SerialName("Env") val env: List<String>? = null,
    @SerialName("WorkingDir") val workingDir: String? = null,
    @SerialName("User") val user: String? = null,
    @SerialName("Entrypoint") val entrypoint: List<String>? = null,
    @SerialName("Cmd") val cmd: List<String>? = null,
)
