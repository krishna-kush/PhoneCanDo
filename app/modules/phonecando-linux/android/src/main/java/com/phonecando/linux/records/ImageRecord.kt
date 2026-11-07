package com.phonecando.linux.records

import com.phonecando.lre.api.OsInfo

/** Image in app/src/engine/linux/types.ts: a VM-like machine made from an env. */
data class ImageRecord(
  val id: String,
  val envId: String,
  val state: ImageState,
  /** The setup step (SetupStep id) a failed create stopped at, or null. */
  val failedStep: String?,
  val error: String?,
  val errorCode: String?,
  val os: OsInfo?,
  val missingTools: List<String>,
  val installCommand: String?,
  /** System + home, as last measured. */
  val sizeBytes: Long,
  val createdAt: Long,
)

enum class ImageState(val id: String) {
  CREATING("creating"),
  READY("ready"),
  FAILED("failed"),
  RESETTING("resetting"),
  DELETING("deleting"),
  ;

  companion object {
    fun of(id: String): ImageState? = entries.firstOrNull { it.id == id }
  }
}
