package com.phonecando.runner.agents

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.MessageDigest
import java.security.SecureRandom

// The agents, in one JSON file (files/state/agents.json). Every change
// writes a temp file, syncs it and renames it over the old one, so a crash
// mid-write leaves the previous list whole. Each agent gets its own engine
// password and bridge token from SecureRandom. One process owns the file,
// so the list is read once and kept; every method is thread-safe. A file
// that cannot be parsed reads as no agents (the next change replaces it).
// Pure JVM (org.json ships with Android; the tests add it).
class AgentStore(
  private val file: File,
  private val random: SecureRandom = SecureRandom(),
  private val clock: () -> Long = System::currentTimeMillis,
) : AgentDirectory {
  private val lock = Any()
  private var cache: List<AgentRecord>? = null

  override fun all(): List<AgentRecord> = synchronized(lock) { loaded() }

  override fun get(id: String): AgentRecord? = all().firstOrNull { it.id == id }

  // Constant-time per comparison: the token is a credential.
  override fun byBridgeToken(token: String): AgentRecord? {
    if (token.isEmpty()) return null
    val want = token.toByteArray(Charsets.UTF_8)
    return all().firstOrNull { MessageDigest.isEqual(it.bridgeToken.toByteArray(Charsets.UTF_8), want) }
  }

  /** A new agent with a fresh id, password and bridge token. */
  fun create(kind: String, name: String, imageId: String): AgentRecord = synchronized(lock) {
    require(kind.isNotBlank()) { "agent kind is empty" }
    require(isValidImageId(imageId)) { "invalid image id" }
    val list = loaded()
    val record = AgentRecord(
      id = unique(list.map { it.id }.toSet(), ID_BYTES),
      kind = kind,
      name = cleanName(name),
      imageId = imageId,
      port = null,
      password = hex(SECRET_BYTES),
      bridgeToken = unique(list.map { it.bridgeToken }.toSet(), SECRET_BYTES),
      createdAt = clock(),
    )
    save(list + record)
    record
  }

  fun rename(id: String, name: String): AgentRecord = update(id) { it.copy(name = cleanName(name)) }

  /** False when there was no such agent. */
  fun delete(id: String): Boolean = synchronized(lock) {
    val list = loaded()
    val rest = list.filter { it.id != id }
    if (rest.size == list.size) return false
    save(rest)
    true
  }

  /** The port the agent's engine last bound; a no-op when it is unchanged. */
  fun setPort(id: String, port: String?) {
    synchronized(lock) {
      val current = loaded().firstOrNull { it.id == id } ?: return
      if (current.port == port) return
      update(id) { it.copy(port = port) }
    }
  }

  private fun update(id: String, change: (AgentRecord) -> AgentRecord): AgentRecord = synchronized(lock) {
    val list = loaded()
    val index = list.indexOfFirst { it.id == id }
    require(index >= 0) { "unknown agent" }
    val changed = change(list[index])
    save(list.toMutableList().also { it[index] = changed })
    changed
  }

  private fun loaded(): List<AgentRecord> {
    cache?.let { return it }
    val list = try {
      parse(file.readText(Charsets.UTF_8))
    } catch (_: Exception) {
      emptyList()
    }
    cache = list
    return list
  }

  private fun save(list: List<AgentRecord>) {
    val dir = file.absoluteFile.parentFile ?: throw IOException("no folder for ${file.name}")
    dir.mkdirs()
    val tmp = File(dir, "${file.name}.tmp")
    try {
      FileOutputStream(tmp).use { out ->
        out.write(serialize(list).toByteArray(Charsets.UTF_8))
        out.fd.sync()
      }
      if (!tmp.renameTo(file)) throw IOException("could not replace ${file.name}")
    } catch (e: IOException) {
      tmp.delete()
      throw e
    }
    cache = list
  }

  // Random hex not already in `taken` (a clash is near impossible; retried anyway).
  private fun unique(taken: Set<String>, bytes: Int): String {
    while (true) {
      val value = hex(bytes)
      if (value !in taken) return value
    }
  }

  private fun hex(bytes: Int): String {
    val raw = ByteArray(bytes).also(random::nextBytes)
    val out = StringBuilder(bytes * 2)
    for (b in raw) {
      val v = b.toInt() and 0xff
      out.append(HEX[v ushr 4]).append(HEX[v and 0x0f])
    }
    return out.toString()
  }

  companion object {
    private const val HEX = "0123456789abcdef"
    private const val ID_BYTES = 8
    // 192 bits for the password and the token.
    private const val SECRET_BYTES = 24
    private const val MAX_NAME_CHARS = 64

    // The image id names a folder under files/images/: no separators, no
    // dot names, short (Unix socket paths under it are capped at 108 bytes).
    private val IMAGE_ID = Regex("[A-Za-z0-9_-][A-Za-z0-9._-]{0,47}")

    fun isValidImageId(id: String): Boolean = IMAGE_ID.matches(id) && id != "." && id != ".."

    private fun cleanName(name: String): String {
      val trimmed = name.trim()
      require(trimmed.isNotEmpty()) { "agent name is empty" }
      return trimmed.take(MAX_NAME_CHARS)
    }

    internal fun parse(text: String): List<AgentRecord> {
      val array = JSONObject(text).optJSONArray("agents") ?: return emptyList()
      val out = ArrayList<AgentRecord>(array.length())
      for (i in 0 until array.length()) {
        val o = array.optJSONObject(i) ?: continue
        val id = o.optString("id", "")
        val password = o.optString("password", "")
        val token = o.optString("bridgeToken", "")
        if (id.isEmpty() || password.isEmpty() || token.isEmpty()) continue
        out += AgentRecord(
          id = id,
          kind = o.optString("kind", ""),
          name = o.optString("name", ""),
          imageId = o.optString("imageId", ""),
          port = if (o.isNull("port")) null else o.optString("port", "").ifEmpty { null },
          password = password,
          bridgeToken = token,
          createdAt = o.optLong("createdAt", 0L),
        )
      }
      return out
    }

    internal fun serialize(list: List<AgentRecord>): String {
      val array = JSONArray()
      for (a in list) {
        array.put(
          JSONObject()
            .put("id", a.id)
            .put("kind", a.kind)
            .put("name", a.name)
            .put("imageId", a.imageId)
            .put("port", a.port ?: JSONObject.NULL)
            .put("password", a.password)
            .put("bridgeToken", a.bridgeToken)
            .put("createdAt", a.createdAt),
        )
      }
      return JSONObject().put("agents", array).toString(2)
    }
  }
}
