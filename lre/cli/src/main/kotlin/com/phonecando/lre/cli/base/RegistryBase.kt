package com.phonecando.lre.cli.base

import com.phonecando.lre.api.ProgressSink
import com.phonecando.lre.oci.http.UrlConnectionTransport
import com.phonecando.lre.oci.ref.ImageRef
import com.phonecando.lre.oci.registry.RegistryClient
import java.io.File

/**
 * Pulls a registry image the documented RegistryClient way (resolve, then
 * fetchBlob per layer, then toBaseImage), with the same mirrors and retry
 * policy as the app. Blobs already in [blobDir] are re-verified and reused.
 */
class RegistryBase(private val client: RegistryClient = RegistryClient(UrlConnectionTransport())) {
    /** @throws com.phonecando.lre.api.LreException for every registry failure (InvalidRef, NoArm64, ...). */
    fun fetch(ref: String, blobDir: File, sink: ProgressSink): FetchedBase {
        val resolved = client.resolve(ImageRef.parse(ref))
        resolved.layers.forEach { client.fetchBlob(resolved, it, blobDir, sink) }
        val info = SourceInfo.Registry(
            ref = resolved.ref.toString(),
            manifestDigest = resolved.manifestDigest,
            layers = resolved.layers.size,
            bytes = resolved.downloadSize,
            sourceHost = resolved.sourceHost,
        )
        return FetchedBase(client.toBaseImage(resolved, blobDir), info)
    }
}
