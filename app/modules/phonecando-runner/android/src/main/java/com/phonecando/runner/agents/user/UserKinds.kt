package com.phonecando.runner.agents.user

import com.phonecando.agents.kit.manifest.ManifestException
import com.phonecando.agents.kit.render.KindException
import com.phonecando.agents.kit.render.RuntimePlugin
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

// The user's kinds on disk, one <id>.json each in [dir]
// (files/state/agent-kinds/user/ on the phone): each listed with what keeps
// it from loading, read, checked, saved and deleted. A save checks the text
// exactly as the catalog loads it (UserKindRules) and writes it as a temp
// file, synced, then renamed over the old one, so a crash mid-write leaves
// the old kind or none, never half of one. A delete is refused while an
// agent is of that kind. Writes hold one lock, so a catalog reload after
// one (KindCatalogs.reload) reads a settled folder. [bundled]: the ids of
// the kinds packaged with the app; [runtimes]: this build's runtime
// plugins. Pure JVM (org.json ships with Android; the tests add it).
class UserKinds(
  private val dir: File,
  private val bundled: Set<String>,
  private val runtimes: Map<String, RuntimePlugin>,
) {
  /** What keeps a manifest from loading: the JSON pointer of the value ("" for the whole file) and why. */
  data class Problem(val path: String, val detail: String)

  /** One file in the folder: its id (from its name), its label when it has one, and why it does not load (null: it does). */
  data class Entry(val id: String, val label: String?, val problem: Problem?)

  sealed interface Saved {
    data class Done(val id: String) : Saved

    /** Nothing was written. */
    data class Refused(val problems: List<Problem>) : Saved
  }

  sealed interface Deleted {
    /** [found] false: there was no such kind. */
    data class Done(val found: Boolean) : Deleted

    /** Nothing was deleted: these agents (by name) are of the kind. */
    data class InUse(val agents: List<String>) : Deleted
  }

  /** Why [text] would not load as a user kind; empty when it would. */
  fun check(text: String): List<Problem> = problemsOf(text.toByteArray(Charsets.UTF_8)).second

  /** Saves [text] as <id>.json; an existing kind of that id only with [replace]. */
  fun save(text: String, replace: Boolean): Saved = synchronized(LOCK) {
    val bytes = text.toByteArray(Charsets.UTF_8)
    val (id, problems) = problemsOf(bytes)
    if (id == null || problems.isNotEmpty()) return Saved.Refused(problems)
    val file = File(dir, UserKindRules.fileName(id))
    if (file.exists() && !replace) return Saved.Refused(listOf(Problem("/id", "you already have an agent kind $id")))
    write(file, bytes)
    Saved.Done(id)
  }

  /** The text of the kind [id]; null when there is none. */
  fun read(id: String): String? {
    if (!UserKindRules.isId(id)) return null
    val file = File(dir, UserKindRules.fileName(id))
    return if (file.isFile) file.readText(Charsets.UTF_8) else null
  }

  /** Deletes the kind [id] unless [usedBy] (the names of the agents of it) has any. */
  fun delete(id: String, usedBy: List<String>): Deleted = synchronized(LOCK) {
    if (usedBy.isNotEmpty()) return Deleted.InUse(usedBy)
    if (!UserKindRules.isId(id)) return Deleted.Done(false)
    val file = File(dir, UserKindRules.fileName(id))
    if (!file.isFile) return Deleted.Done(false)
    if (!file.delete()) throw IOException("could not delete ${file.name}")
    Deleted.Done(true)
  }

  /** Every <name>.json in the folder, by name. */
  fun list(): List<Entry> {
    val files = dir.listFiles { f -> f.name.endsWith(UserKindRules.SUFFIX) }.orEmpty().sortedBy { it.name }
    return files.map { file ->
      val id = file.name.removeSuffix(UserKindRules.SUFFIX)
      if (!file.isFile || file.length() > UserKindRules.MAX_BYTES) {
        return@map Entry(id, null, Problem("", if (file.isFile) "larger than ${UserKindRules.MAX_BYTES / 1024} KiB" else "not a file"))
      }
      val bytes = file.readBytes()
      val (found, problems) = problemsOf(bytes)
      val problem = problems.firstOrNull() ?: Problem("/id", "its id is $found, not $id").takeIf { found != id }
      Entry(id, labelOf(bytes), problem)
    }
  }

  // The manifest's id (null when it does not decode that far) and its problems.
  private fun problemsOf(bytes: ByteArray): Pair<String?, List<Problem>> = try {
    UserKindRules.kind(bytes, bundled, runtimes).id to emptyList()
  } catch (e: ManifestException) {
    null to listOf(Problem(e.path, e.detail))
  } catch (e: KindException) {
    null to listOf(Problem("", e.message ?: "this build cannot run it"))
  }

  private fun labelOf(bytes: ByteArray): String? = try {
    JSONObject(bytes.toString(Charsets.UTF_8)).optString("label").ifEmpty { null }
  } catch (_: Exception) {
    null
  }

  private fun write(file: File, bytes: ByteArray) {
    dir.mkdirs()
    // Not <name>.json, so a catalog load never reads it.
    val tmp = File(dir, "${file.name}.tmp")
    try {
      FileOutputStream(tmp).use { out ->
        out.write(bytes)
        out.fd.sync()
      }
      if (!tmp.renameTo(file)) throw IOException("could not replace ${file.name}")
    } catch (e: IOException) {
      tmp.delete()
      throw e
    }
  }

  private companion object {
    // One folder per process, whichever instance writes it.
    val LOCK = Any()
  }
}
