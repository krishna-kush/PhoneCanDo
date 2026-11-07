package com.phonecando.linux.records

import com.phonecando.lre.api.OsInfo
import com.phonecando.lre.api.PackageFamily

// Records with every field set (and every source kind), shared by the record tests.
object Samples {
  val debian = OsInfo("debian", "13", listOf("linux"), "Debian GNU/Linux 13 (trixie)", PackageFamily.APT, "/bin/bash")
  val bare = OsInfo("scratchy", null, emptyList(), null, null, null)

  fun env(id: String, source: EnvSource = EnvSource.Android, state: EnvState = EnvState.READY) =
    EnvRecord(id, "name $id", source, state, null, 0, 1_700_000_000_000L, null, null)

  val envs = listOf(
    EnvRecord("default", "Default", EnvSource.Default("2026.11.06-1"), EnvState.READY, debian, 0, 1L, null, null),
    EnvRecord(
      "k3x9qa", "kalilinux/kali-rolling:latest",
      EnvSource.Registry("kalilinux/kali-rolling", "latest", "sha256:" + "a".repeat(64)),
      EnvState.FAILED, bare, 123_456_789_012L, 2L, "network: network error on https://x (http 503)", "network",
    ),
    EnvRecord("android", "Android", EnvSource.Android, EnvState.READY, null, 0, 3L, null, null),
  )

  fun image(id: String, envId: String = "default", state: ImageState = ImageState.READY) =
    ImageRecord(id, envId, state, null, null, null, null, emptyList(), null, 0, 1_700_000_000_000L)

  val images = listOf(
    ImageRecord("a1b2c3", "default", ImageState.READY, null, null, null, debian, listOf("rg"), "apt-get install -y ripgrep", 987_654_321L, 4L),
    ImageRecord("zz9", "k3x9qa", ImageState.FAILED, "unpack", "no_space: needs 10 bytes, 1 free", "no_space", null, emptyList(), null, 0, 5L),
  )
}
