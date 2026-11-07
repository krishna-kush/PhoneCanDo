package com.phonecando.linux.records

import com.phonecando.lre.api.OsInfo

/** Env in app/src/engine/linux/types.ts: a fixed base OS, never modified. */
data class EnvRecord(
  val id: String,
  val name: String,
  val source: EnvSource,
  val state: EnvState,
  /** From the first image made from it; null before. */
  val os: OsInfo?,
  /** Bytes of the downloaded layers (0 for Default and Android). */
  val sizeBytes: Long,
  val createdAt: Long,
  val error: String?,
  val errorCode: String?,
) {
  val isLinux: Boolean get() = source !is EnvSource.Android
}

sealed interface EnvSource {
  /** The image baked into this APK; [version] from its image.json. */
  data class Default(val version: String) : EnvSource

  /** A registry image; [digest] is the arm64 manifest digest, empty until resolved. */
  data class Registry(val image: String, val tag: String, val digest: String) : EnvSource

  /** No Linux. */
  data object Android : EnvSource
}

enum class EnvState(val id: String) {
  DOWNLOADING("downloading"),
  READY("ready"),
  FAILED("failed"),
  ;

  companion object {
    fun of(id: String): EnvState? = entries.firstOrNull { it.id == id }
  }
}
