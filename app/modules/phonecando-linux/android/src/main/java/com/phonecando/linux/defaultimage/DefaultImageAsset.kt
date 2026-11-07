package com.phonecando.linux.defaultimage

import android.content.res.AssetManager
import com.phonecando.lre.api.BaseImage
import com.phonecando.lre.api.BaseLayer
import com.phonecando.lre.api.Compression
import java.io.BufferedInputStream
import java.io.InputStream

/**
 * The Default env's base: one xz layer streamed from the APK
 * (`default-image/rootfs.tar.xz`, stored uncompressed, see build.gradle's
 * noCompress) and no Docker config. full and lite only, and only once
 * staged; play and unstaged dev builds have neither file.
 */
class DefaultImageAsset(private val assets: AssetManager) {
  /** The staged image.json, or null when this build has no Default image. */
  fun info(): DefaultImageInfo? = try {
    assets.open(INFO).use { DefaultImageInfo.parse(it.readBytes().toString(Charsets.UTF_8)) }
  } catch (_: Exception) {
    null
  }

  /** Both files are in the APK. */
  fun isPresent(): Boolean = info() != null && try {
    assets.open(ROOTFS).close()
    true
  } catch (_: Exception) {
    false
  }

  fun base(info: DefaultImageInfo): BaseImage = BaseImage(listOf(Layer(assets, info.size)), config = null)

  private class Layer(private val assets: AssetManager, override val size: Long?) : BaseLayer {
    override val compression = Compression.XZ

    override fun open(): InputStream = BufferedInputStream(assets.open(ROOTFS, AssetManager.ACCESS_STREAMING), 64 * 1024)
  }

  private companion object {
    const val INFO = "default-image/image.json"
    const val ROOTFS = "default-image/rootfs.tar.xz"
  }
}
