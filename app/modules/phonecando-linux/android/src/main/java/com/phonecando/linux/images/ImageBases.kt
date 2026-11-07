package com.phonecando.linux.images

import com.phonecando.linux.defaultimage.DefaultImageAsset
import com.phonecando.linux.errors.LinuxError
import com.phonecando.linux.errors.LinuxErrorCode
import com.phonecando.linux.host.LinuxPaths
import com.phonecando.linux.records.EnvRecord
import com.phonecando.linux.records.EnvSource
import com.phonecando.linux.registry.EnvBase
import com.phonecando.lre.api.BaseImage
import com.phonecando.lre.api.LreException
import com.phonecando.lre.oci.registry.RegistryClient

/** The base OS an image is made (and reset) from, by env kind. */
class ImageBases(
  private val paths: LinuxPaths,
  private val defaultImage: DefaultImageAsset,
  private val registry: RegistryClient,
) {
  /**
   * Default: the APK's xz layer. Registry: the env's verified blobs and
   * Docker config. Android has no base.
   *
   * @throws LinuxError linux_unavailable when the Default image is not in this build.
   * @throws LreException.NotFound when a registry env's base or a blob is missing.
   */
  fun of(env: EnvRecord): BaseImage = when (env.source) {
    is EnvSource.Default -> {
      val info = defaultImage.info()
        ?: throw LinuxError(LinuxErrorCode.LINUX_UNAVAILABLE, "the Default image is not in this build")
      defaultImage.base(info)
    }
    is EnvSource.Registry -> {
      val file = paths.envBase(env.id)
      val resolved = (if (file.isFile) EnvBase.decode(file.readText(Charsets.UTF_8)) else null)
        ?: throw LreException.NotFound("the downloaded base of env ${env.id}")
      registry.toBaseImage(resolved, paths.envBlobs(env.id))
    }
    EnvSource.Android -> throw LinuxError(LinuxErrorCode.NOT_FOUND, "an Android env has no Linux base")
  }
}
