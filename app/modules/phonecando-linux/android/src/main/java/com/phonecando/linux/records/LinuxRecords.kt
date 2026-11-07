package com.phonecando.linux.records

import java.io.File

/**
 * Every env and image record, in memory and written through to
 * `<stateDir>/envs.json` and `images.json` on each change. All reads and
 * changes go through one lock, so a check and the change it guards (no
 * image uses this env, then remove it) are one step. [onChanged] runs after
 * a change was written, outside the lock. Pure JVM.
 */
class LinuxRecords(stateDir: File, private val onChanged: () -> Unit = {}) {
  private val envFile = RecordFile(File(stateDir, "envs.json"))
  private val imageFile = RecordFile(File(stateDir, "images.json"))
  private val lock = Any()
  private var envs: List<EnvRecord> = load(envFile, RecordJson::decodeEnvs)
  private var images: List<ImageRecord> = load(imageFile, RecordJson::decodeImages)

  fun envs(): List<EnvRecord> = synchronized(lock) { envs }

  fun images(): List<ImageRecord> = synchronized(lock) { images }

  fun env(id: String): EnvRecord? = envs().firstOrNull { it.id == id }

  fun image(id: String): ImageRecord? = images().firstOrNull { it.id == id }

  /** Runs [block] under the lock; whatever it changed is written before the lock is released. */
  fun <T> transact(block: Transaction.() -> T): T {
    val changed: Boolean
    val result: T
    synchronized(lock) {
      val tx = Transaction(envs, images)
      result = tx.block()
      val envsChanged = tx.envs != envs
      val imagesChanged = tx.images != images
      if (envsChanged) envFile.write(RecordJson.encodeEnvs(tx.envs))
      if (imagesChanged) imageFile.write(RecordJson.encodeImages(tx.images))
      envs = tx.envs
      images = tx.images
      changed = envsChanged || imagesChanged
    }
    if (changed) onChanged()
    return result
  }

  /** The working copy one [transact] edits; a record keeps its place when replaced. */
  class Transaction(envs: List<EnvRecord>, images: List<ImageRecord>) {
    var envs: List<EnvRecord> = envs
      private set
    var images: List<ImageRecord> = images
      private set

    fun env(id: String): EnvRecord? = envs.firstOrNull { it.id == id }

    fun image(id: String): ImageRecord? = images.firstOrNull { it.id == id }

    fun putEnv(env: EnvRecord) {
      envs = if (envs.any { it.id == env.id }) envs.map { if (it.id == env.id) env else it } else envs + env
    }

    fun putImage(image: ImageRecord) {
      images = if (images.any { it.id == image.id }) images.map { if (it.id == image.id) image else it } else images + image
    }

    /** Applies [change] to the env [id]; the new record, or null when there is none. */
    fun updateEnv(id: String, change: (EnvRecord) -> EnvRecord): EnvRecord? = env(id)?.let(change)?.also(::putEnv)

    fun updateImage(id: String, change: (ImageRecord) -> ImageRecord): ImageRecord? = image(id)?.let(change)?.also(::putImage)

    fun removeEnv(id: String) {
      envs = envs.filterNot { it.id == id }
    }

    fun removeImage(id: String) {
      images = images.filterNot { it.id == id }
    }
  }

  private companion object {
    // An unreadable file is moved aside and we start empty: the image dirs
    // stay on disk, only their records are lost.
    fun <T> load(file: RecordFile, decode: (String) -> List<T>): List<T> {
      val text = file.read() ?: return emptyList()
      return try {
        decode(text)
      } catch (_: Exception) {
        file.quarantine()
        emptyList()
      }
    }
  }
}
