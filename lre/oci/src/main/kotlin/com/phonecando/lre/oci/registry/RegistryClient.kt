package com.phonecando.lre.oci.registry

import com.phonecando.lre.api.BaseImage
import com.phonecando.lre.api.LreException
import com.phonecando.lre.api.lreNet
import com.phonecando.lre.oci.auth.TokenCache
import com.phonecando.lre.oci.auth.TokenClient
import com.phonecando.lre.oci.blob.BlobDownloader
import com.phonecando.lre.oci.blob.Digest
import com.phonecando.lre.oci.blob.FileLayer
import com.phonecando.lre.oci.ref.ImageRef
import com.phonecando.network.CancelSignal
import com.phonecando.network.Progress
import com.phonecando.network.ProgressSink
import com.phonecando.network.download.HashCheckpoints
import com.phonecando.network.http.HttpPort
import java.io.File
import java.io.IOException

/**
 * Pulls container images for the phone: resolves a reference to its
 * linux/arm64 manifest and downloads verified layer blobs, from any
 * registry with anonymous pull (Docker Hub, ghcr.io, quay.io, ...).
 * Docker Hub official images fall back to [mirrors].
 *
 * Blocking; call from a background thread. Safe to share between threads,
 * but download one blob into one directory at a time. Every failure is an
 * [LreException], except local disk errors ([IOException]).
 *
 * Typical use: `resolve` → `fetchBlob` for each layer → `toBaseImage`.
 */
class RegistryClient(
    port: HttpPort,
    private val mirrors: Mirrors = Mirrors.default,
    /** Wall clock for token expiry; tests move it. */
    nowMillis: () -> Long = System::currentTimeMillis,
    /** Blocks for a pause between tries on one host; tests pass a recorder. */
    sleeper: (Long) -> Unit = Thread::sleep,
) {
    private val http = RegistryHttp(port, TokenClient(port), TokenCache(nowMillis))
    private val fallback = SourceFallback(SourceFallback.PER_HOST, sleeper)
    private val resolver = ManifestResolver(http)

    // How far each partial blob was hashed when its try stopped: the next try skips re-reading it.
    private val downloader = BlobDownloader(HashCheckpoints())

    /**
     * Finds [ref]'s linux/arm64 image and reads its config.
     *
     * @throws LreException.NoArm64 when the image has no linux/arm64 build.
     * @throws LreException.UnsupportedLayer for foreign / non-distributable / unknown layers.
     * @throws LreException.NotFound when the image or tag does not exist (or is private).
     * @throws LreException.RateLimited when Docker Hub refused and no mirror could serve.
     */
    fun resolve(ref: ImageRef, cancel: CancelSignal = CancelSignal.NEVER): ResolvedImage =
        fallback.run(mirrors.sourcesFor(ref), cancel) { resolver.resolveFrom(it, ref, cancel) }

    /**
     * Downloads [layer] to `<destDir>/sha256-<hex>` and returns that file.
     * Resumes `<destDir>/sha256-<hex>.part` from an earlier run (a server
     * that ignores `Range` gets a fresh download); reuses a complete file
     * after re-verifying it. Reports [Progress] step `download` in bytes,
     * and `verify` while it re-reads a complete file or a partial one an
     * earlier try in this process did not hash. Cancelling keeps the
     * partial file for next time.
     *
     * @throws LreException.DigestMismatch when the bytes do not match (the partial is deleted).
     * @throws LreException.UnsupportedLayer for a digest that is not sha256.
     * @throws LreException.NoSpace when [destDir] cannot hold the rest of the blob.
     */
    fun fetchBlob(
        resolved: ResolvedImage,
        layer: LayerDescriptor,
        destDir: File,
        sink: ProgressSink = ProgressSink.NONE,
        cancel: CancelSignal = CancelSignal.NEVER,
    ): File {
        val digest = Digest.parse(layer.digest)
        if (layer.size < 0) throw LreException.Corrupt("layer size of $digest")
        if (!destDir.isDirectory && !destDir.mkdirs() && !destDir.isDirectory) {
            throw IOException("cannot create the download dir ${destDir.name}")
        }
        lreNet { downloader.existing(digest, layer.size, destDir, sink, cancel) }?.let {
            sink.report(Progress(BlobDownloader.STEP, layer.size, layer.size))
            return it
        }
        val needed = layer.size - downloader.partialBytes(digest, layer.size, destDir)
        val free = destDir.usableSpace
        if (free in 1 until needed) throw LreException.NoSpace(needed, free)

        val path = "blobs/$digest"
        val sources = mirrors.sourcesFor(resolved.ref).sortedByDescending { it.host == resolved.sourceHost }
        return fallback.run(sources, cancel) { source ->
            downloader.download(http.opener(source, path, "layer $digest", cancel), digest, layer.size, destDir, sink, cancel)
        }
    }

    /**
     * The downloaded image as the runtime's [BaseImage]: layers open the
     * files [fetchBlob] wrote into [blobDir], bottom first.
     *
     * @throws LreException.NotFound when a layer has not been downloaded.
     */
    fun toBaseImage(resolved: ResolvedImage, blobDir: File): BaseImage {
        val layers = resolved.layers.map { layer ->
            val file = File(blobDir, Digest.parse(layer.digest).fileName)
            if (!file.isFile || file.length() != layer.size) throw LreException.NotFound("downloaded layer ${layer.digest}")
            FileLayer(file, layer.compression, layer.size)
        }
        return BaseImage(layers, resolved.config)
    }
}
