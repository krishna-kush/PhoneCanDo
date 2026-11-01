package com.phonecando.runner.packs

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Base64
import android.util.Log
import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.ExperimentalPceApi
import com.phonecando.pce.api.Recovery
import com.phonecando.pce.core.Pce
import com.phonecando.pce.pack.FlowResult
import com.phonecando.pce.pack.Pack
import com.phonecando.pce.pack.PackManifest
import com.phonecando.pce.pack.PackManifestEntry
import com.phonecando.pce.pack.PackRuntime
import com.phonecando.runner.R
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI
import java.security.KeyFactory
import java.security.PublicKey
import java.security.spec.X509EncodedKeySpec
import org.json.JSONArray
import org.json.JSONObject

/**
 * Host-owned pack storage. The PCE verifies and executes packs; this class
 * fetches the signed manifest, checks download hashes, stores each version in
 * app-private storage and swaps the active pointer atomically.
 *
 * A failed pack never replaces the active version. Previous versions stay on
 * disk for rollback.
 */
@OptIn(ExperimentalPceApi::class)
class PackStore(
  context: Context,
  pce: Pce,
  pceVersion: String = "0.1.0",
) {
  private val appContext = context.applicationContext
  private val root = File(appContext.filesDir, "phonecando-home/automation/packs")
  private val key = trustedKey(appContext)
  private val runtime = key?.let { PackRuntime(pce, it, pceVersion) }

  /** Installed packs and their active/previous versions. */
  data class InstalledPack(val id: String, val active: Int?, val versions: List<Int>)

  /** One pack version handled by a refresh. */
  data class PackInstall(val id: String, val version: Int, val active: Boolean)

  /** One pack version rejected by a refresh. */
  data class PackFailure(val id: String, val version: Int, val error: PceError)

  /** Per-pack outcome of a manifest refresh. */
  data class RefreshResult(
    val installed: List<PackInstall>,
    val failed: List<PackFailure>,
  )

  @Synchronized
  fun describeJson(): JSONArray = JSONArray().apply {
    list().forEach { pack ->
      val out = JSONObject()
        .put("id", pack.id)
        .put("active", pack.active ?: JSONObject.NULL)
        .put("versions", JSONArray(pack.versions))
      if (pack.active != null) {
        when (val active = activePack(pack.id)) {
          is PceResult.Ok -> out.put("flows", flowsJson(active.value))
          is PceResult.Err -> Unit
        }
      }
      put(out)
    }
  }

  private fun flowsJson(pack: Pack): JSONArray = JSONArray().apply {
    pack.flows.forEach { flow ->
      put(
        JSONObject()
          .put("id", flow.id)
          .put("steps", flow.steps.size)
          .put("params", JSONObject().apply {
            flow.params.forEach { (name, param) ->
              put(name, JSONObject().put("type", param.type).put("required", param.required))
            }
          })
      )
    }
  }

  @Synchronized
  fun list(): List<InstalledPack> {
    val dirs = root.listFiles()?.filter { it.isDirectory } ?: emptyList()
    return dirs.mapNotNull { idDir ->
      val id = idDir.name
      if (!SAFE_ID.matches(id)) return@mapNotNull null
      val versions = versions(id)
      if (versions.isEmpty()) null else InstalledPack(
        id = id,
        active = readActive(id)?.takeIf { it in versions },
        versions = versions,
      )
    }.sortedBy { it.id }
  }

  /**
   * Fetch `manifest.json` and its detached `manifest.json.sig`, verify both,
   * then download, hash-check and verify every pack before installing it.
   */
  @Synchronized
  fun refresh(manifestUrl: String): PceResult<RefreshResult> {
    unavailable()?.let { return it }
    val runtime = runtime ?: return unavailable()!!
    val key = key ?: return unavailable()!!

    val manifestBytes = when (val fetched = fetch(manifestUrl)) {
      is PceResult.Ok -> fetched.value
      is PceResult.Err -> return fetched
    }
    val signatureBytes = when (val fetched = fetch(signatureUrl(manifestUrl))) {
      is PceResult.Ok -> fetched.value
      is PceResult.Err -> return fetched
    }
    val manifest = when (
      val verified = PackManifest.verify(
        manifestJson = String(manifestBytes, Charsets.UTF_8),
        signatureBase64 = String(signatureBytes, Charsets.UTF_8).trim(),
        publicKey = key,
      )
    ) {
      is PceResult.Ok -> verified.value
      is PceResult.Err -> return verified
    }

    val installed = mutableListOf<PackInstall>()
    val failed = mutableListOf<PackFailure>()
    for (entry in manifest.packs) {
      try {
        val bytes = when (val fetched = fetch(entry.url)) {
          is PceResult.Ok -> fetched.value
          is PceResult.Err -> {
            failed += PackFailure(entry.id, entry.version, fetched.error)
            continue
          }
        }
        if (!entry.matchesSha256(bytes)) {
          failed += PackFailure(
            entry.id,
            entry.version,
            invalid("sha256 mismatch for ${entry.id}@${entry.version}").error,
          )
          continue
        }
        val packJson = String(bytes, Charsets.UTF_8)
        val pack = when (val loaded = runtime.load(packJson, entry.signature)) {
          is PceResult.Ok -> loaded.value
          is PceResult.Err -> {
            failed += PackFailure(entry.id, entry.version, loaded.error)
            continue
          }
        }
        if (pack.id != entry.id || pack.version != entry.version) {
          failed += PackFailure(
            entry.id,
            entry.version,
            invalid("Pack content does not match manifest id/version").error,
          )
          continue
        }
        installed += PackInstall(entry.id, entry.version, install(entry, packJson))
      } catch (failure: Exception) {
        failed += PackFailure(
          entry.id,
          entry.version,
          PceError(
            code = ErrorCode.INTERNAL,
            message = failure.message ?: "Pack install failed",
            recovery = Recovery("pack", "Retry refresh"),
          ),
        )
      }
    }
    return PceResult.Ok(RefreshResult(installed, failed))
  }

  /** Switch [id] to the highest installed version below the active one. */
  @Synchronized
  fun rollback(id: String): PceResult<InstalledPack> {
    if (!SAFE_ID.matches(id)) return invalid("Invalid pack id")
    val versions = versions(id)
    if (versions.isEmpty()) return notFound("Pack $id is not installed")
    val active = readActive(id) ?: return notFound("Pack $id has no active version")
    val previous = versions.firstOrNull { it < active }
      ?: return notFound("Pack $id has no previous version")
    val runtime = runtime ?: return unavailable()!!
    val dir = File(File(root, id), previous.toString())
    val packJson = File(dir, "pack.json")
    val packSig = File(dir, "pack.sig")
    if (!packJson.isFile || !packSig.isFile) return notFound("Pack $id@$previous is incomplete")
    when (val loaded = runtime.load(packJson.readText(), packSig.readText().trim())) {
      is PceResult.Err -> return loaded
      is PceResult.Ok -> Unit
    }
    writeActive(id, previous)
    return PceResult.Ok(InstalledPack(id, previous, versions))
  }

  /** Load and verify the active pack for [id]. */
  @Synchronized
  fun activePack(id: String): PceResult<Pack> {
    if (!SAFE_ID.matches(id)) return invalid("Invalid pack id")
    val runtime = runtime ?: return unavailable()!!
    val active = readActive(id) ?: return notFound("Pack $id has no active version")
    val dir = File(File(root, id), active.toString())
    val packJson = File(dir, "pack.json")
    val packSig = File(dir, "pack.sig")
    if (!packJson.isFile || !packSig.isFile) return notFound("Pack $id@$active is incomplete")
    return runtime.load(packJson.readText(), packSig.readText().trim())
  }

  /** Run [flowId] from the active pack against the installed target app. */
  @Suppress("DEPRECATION")
  suspend fun run(
    id: String,
    flowId: String,
    params: Map<String, String>,
  ): PceResult<FlowResult> {
    val pack = when (val loaded = activePack(id)) {
      is PceResult.Ok -> loaded.value
      is PceResult.Err -> return loaded
    }
    val runtime = runtime ?: return unavailable()!!
    val versionCode = try {
      val info = appContext.packageManager.getPackageInfo(pack.app.packageName, 0)
      if (Build.VERSION.SDK_INT >= 28) info.longVersionCode.toInt() else info.versionCode
    } catch (_: PackageManager.NameNotFoundException) {
      return PceResult.Err(
        PceError(
          code = ErrorCode.NOT_FOUND,
          message = "Target app ${pack.app.packageName} is not installed",
          recovery = Recovery("pack", "Install the target app or refresh the pack"),
        )
      )
    }
    return runtime.run(pack, flowId, versionCode, params)
  }

  private fun install(entry: PackManifestEntry, packJson: String): Boolean {
    val idDir = File(root, entry.id)
    if (!idDir.isDirectory && !idDir.mkdirs()) {
      throw IOException("Cannot create pack directory for ${entry.id}")
    }
    val versionDir = File(idDir, entry.version.toString())
    if (versionDir.isDirectory) {
      val existing = File(versionDir, "pack.json")
      if (!existing.isFile || existing.readText() != packJson) {
        throw IOException("${entry.id}@${entry.version} is already installed with different content")
      }
    } else {
      val temp = File(idDir, ".${entry.version}.tmp")
      if (temp.exists() && !temp.deleteRecursively()) {
        throw IOException("Cannot clear temp pack directory")
      }
      if (!temp.mkdirs()) throw IOException("Cannot create temp pack directory")
      File(temp, "pack.json").writeText(packJson)
      File(temp, "pack.sig").writeText(entry.signature)
      if (!temp.renameTo(versionDir)) {
        throw IOException("Cannot atomically install ${entry.id}@${entry.version}")
      }
    }
    val active = readActive(entry.id)
    if (active == null || entry.version > active) {
      writeActive(entry.id, entry.version)
      return true
    }
    return false
  }

  private fun versions(id: String): List<Int> =
    File(root, id).listFiles()
      ?.filter { dir ->
        dir.isDirectory &&
          dir.name.toIntOrNull() != null &&
          File(dir, "pack.json").isFile &&
          File(dir, "pack.sig").isFile
      }
      ?.mapNotNull { it.name.toIntOrNull() }
      ?.sortedDescending()
      ?: emptyList()

  private fun readActive(id: String): Int? =
    File(File(root, id), "active").takeIf { it.isFile }?.readText()?.toIntOrNull()

  private fun writeActive(id: String, version: Int) {
    val idDir = File(root, id)
    val target = File(idDir, "active")
    val temp = File(idDir, ".active.tmp")
    temp.writeText(version.toString())
    if (!temp.renameTo(target)) {
      if (target.exists() && !target.delete()) throw IOException("Cannot replace active pack pointer")
      if (!temp.renameTo(target)) throw IOException("Cannot write active pack pointer")
    }
  }

  private fun fetch(url: String): PceResult<ByteArray> {
    val uri = try {
      URI(url)
    } catch (_: Exception) {
      return invalid("Invalid URL: $url")
    }
    val scheme = uri.scheme?.lowercase()
    val host = uri.host
    if (scheme != "https" && !(scheme == "http" && isLoopback(host))) {
      return invalid("Pack URLs must be https or loopback http")
    }
    val connection = try {
      uri.toURL().openConnection() as HttpURLConnection
    } catch (failure: Exception) {
      return invalid("Invalid URL: ${failure.message}")
    }
    connection.connectTimeout = 10_000
    connection.readTimeout = 15_000
    connection.instanceFollowRedirects = false
    connection.requestMethod = "GET"
    return try {
      val code = connection.responseCode
      if (code != HttpURLConnection.HTTP_OK) {
        return if (code == HttpURLConnection.HTTP_NOT_FOUND) {
          notFound("HTTP 404 for $url")
        } else {
          PceResult.Err(
            PceError(
              code = ErrorCode.BACKEND_UNAVAILABLE,
              message = "HTTP $code for $url",
              recovery = Recovery("pack", "Retry refresh"),
            )
          )
        }
      }
      val input = connection.inputStream
      val output = ByteArrayOutputStream()
      val buffer = ByteArray(16 * 1024)
      var total = 0
      while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        total += read
        if (total > MAX_BYTES) return invalid("Download exceeds $MAX_BYTES bytes")
        output.write(buffer, 0, read)
      }
      PceResult.Ok(output.toByteArray())
    } catch (failure: Exception) {
      PceResult.Err(
        PceError(
          code = ErrorCode.BACKEND_UNAVAILABLE,
          message = "Download failed: ${failure.message}",
          recovery = Recovery("pack", "Retry refresh"),
        )
      )
    } finally {
      connection.disconnect()
    }
  }

  private fun signatureUrl(manifestUrl: String): String {
    val uri = URI(manifestUrl)
    return URI(uri.scheme, uri.authority, "${uri.path}.sig", uri.query, uri.fragment).toString()
  }

  private fun unavailable(): PceResult.Err? {
    if (Build.VERSION.SDK_INT < 33) {
      return PceResult.Err(
        PceError(
          code = ErrorCode.PACK_INCOMPATIBLE,
          message = "Packs require Android 13 (API 33) for Ed25519",
          recovery = Recovery("pack", "Update Android or bundle an Ed25519 provider"),
        )
      )
    }
    if (runtime == null) {
      return PceResult.Err(
        PceError(
          code = ErrorCode.PACK_INCOMPATIBLE,
          message = "No trusted pack public key is configured",
          recovery = Recovery("pack", "Set the app's pack public key"),
        )
      )
    }
    return null
  }

  private fun invalid(message: String): PceResult.Err =
    PceResult.Err(
      PceError(
        code = ErrorCode.INVALID_PACK,
        message = message,
        recovery = Recovery("pack", "Fix the manifest, pack or URL"),
      )
    )

  private fun notFound(message: String): PceResult.Err =
    PceResult.Err(
      PceError(
        code = ErrorCode.NOT_FOUND,
        message = message,
        recovery = Recovery("pack", "List installed packs"),
      )
    )

  private companion object {
    private const val TAG = "PhoneCanDoPacks"
    private const val MAX_BYTES = 1024 * 1024
    private val SAFE_ID = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")

    private fun isLoopback(host: String?): Boolean =
      host == "127.0.0.1" || host == "localhost" || host == "::1" || host == "[::1]"

    private fun trustedKey(context: Context): PublicKey? {
      if (Build.VERSION.SDK_INT < 33) return null
      val encoded = runCatching {
        context.getString(R.string.phonecando_pack_public_key).trim()
      }.getOrNull()
      if (encoded.isNullOrEmpty()) return null
      return try {
        val bytes = Base64.decode(encoded, Base64.DEFAULT)
        KeyFactory.getInstance("Ed25519")
          .generatePublic(X509EncodedKeySpec(bytes))
      } catch (failure: Exception) {
        Log.w(TAG, "Ignoring invalid pack public key", failure)
        null
      }
    }
  }
}
