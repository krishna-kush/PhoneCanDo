package com.phonecando.pce.pack

import com.phonecando.pce.api.PceError
import com.phonecando.pce.api.PceResult
import com.phonecando.pce.api.ErrorCode
import com.phonecando.pce.api.ExperimentalPceApi
import com.phonecando.pce.api.Recovery
import java.net.URI
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.PublicKey
import java.security.Signature
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * A signed pack index. The host fetches the exact manifest bytes and a
 * detached Ed25519 signature, verifies both, then downloads and verifies each
 * listed pack before installing it.
 *
 * The manifest is data only. It cannot execute code and it is never trusted
 * until [verify] succeeds.
 */
@ExperimentalPceApi
data class PackManifest(
    val schema: String,
    val generatedAt: String,
    val packs: List<PackManifestEntry>,
) {
    companion object {
        const val SCHEMA = "phonecando.manifest/v1"
        private val json = Json {
            encodeDefaults = true
            ignoreUnknownKeys = false
        }
        private val idPattern = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
        private val sha256Pattern = Regex("^[0-9a-fA-F]{64}$")

        /**
         * Verify [signatureBase64] over the exact UTF-8 [manifestJson] bytes,
         * parse it strictly, and validate every entry. Expected failures are
         * typed `PceResult.Err`.
         */
        @OptIn(ExperimentalEncodingApi::class)
        fun verify(
            manifestJson: String,
            signatureBase64: String,
            publicKey: PublicKey,
        ): PceResult<PackManifest> {
            val signature = try {
                Base64.Default.decode(signatureBase64)
            } catch (_: IllegalArgumentException) {
                return signatureInvalid("Manifest signature is not valid base64")
            }
            if (!signatureValid(manifestJson, signature, publicKey)) {
                return signatureInvalid("Manifest signature does not match the trusted key")
            }
            val dto = try {
                json.decodeFromString(ManifestDto.serializer(), manifestJson)
            } catch (failure: Exception) {
                return invalid("Invalid manifest JSON: ${failure.message}")
            }
            if (dto.schema != SCHEMA) {
                return incompatible("Unsupported manifest schema: ${dto.schema}")
            }
            if (dto.generatedAt.isBlank()) {
                return invalid("Manifest generatedAt must not be blank")
            }
            val ids = HashSet<String>()
            for (entry in dto.packs) {
                validate(entry)?.let { return it }
                if (!ids.add(entry.id)) {
                    return invalid("Duplicate pack id in manifest: ${entry.id}")
                }
            }
            return PceResult.Ok(
                PackManifest(
                    schema = dto.schema,
                    generatedAt = dto.generatedAt,
                    packs = dto.packs.map { it.toApi() },
                )
            )
        }

        /** Lowercase hex SHA-256 of [content], used for manifest integrity checks. */
        fun sha256Hex(content: ByteArray): String =
            MessageDigest.getInstance("SHA-256")
                .digest(content)
                .joinToString("") { "%02x".format(it.toInt() and 0xff) }

        @OptIn(ExperimentalEncodingApi::class)
        private fun validate(entry: ManifestEntryDto): PceResult.Err? {
            if (!idPattern.matches(entry.id)) {
                return invalid("Manifest pack id is not path-safe: ${entry.id}")
            }
            if (entry.version <= 0) {
                return invalid("Manifest version must be positive for ${entry.id}")
            }
            if (!sha256Pattern.matches(entry.sha256)) {
                return invalid("Manifest sha256 is invalid for ${entry.id}")
            }
            val uri = try {
                URI(entry.url)
            } catch (_: Exception) {
                return invalid("Manifest url is invalid for ${entry.id}")
            }
            if (uri.scheme !in setOf("http", "https") || uri.host.isNullOrBlank()) {
                return invalid("Manifest url must be absolute http(s) for ${entry.id}")
            }
            val packSignature = try {
                Base64.Default.decode(entry.signature)
            } catch (_: IllegalArgumentException) {
                return invalid("Pack signature is not valid base64 for ${entry.id}")
            }
            if (packSignature.size != 64) {
                return invalid("Pack signature must be 64 bytes for ${entry.id}")
            }
            if (entry.contract.isBlank() || entry.minPce.isBlank()) {
                return invalid("Manifest contract/minPce must not be blank for ${entry.id}")
            }
            return null
        }

        private fun signatureValid(
            manifestJson: String,
            signature: ByteArray,
            publicKey: PublicKey,
        ): Boolean = try {
            val verifier = Signature.getInstance("Ed25519")
            verifier.initVerify(publicKey)
            verifier.update(manifestJson.toByteArray(StandardCharsets.UTF_8))
            verifier.verify(signature)
        } catch (_: Exception) {
            false
        }

        private fun invalid(message: String): PceResult.Err =
            PceResult.Err(
                PceError(
                    code = ErrorCode.INVALID_PACK,
                    message = message,
                    recovery = Recovery("pack", "Fix the pack manifest"),
                )
            )

        private fun signatureInvalid(message: String): PceResult.Err =
            PceResult.Err(
                PceError(
                    code = ErrorCode.PACK_SIGNATURE_INVALID,
                    message = message,
                    recovery = Recovery("pack", "Re-sign the manifest or reject it"),
                )
            )

        private fun incompatible(message: String): PceResult.Err =
            PceResult.Err(
                PceError(
                    code = ErrorCode.PACK_INCOMPATIBLE,
                    message = message,
                    recovery = Recovery("pack", "Use a manifest for this pce"),
                )
            )
    }
}

/** One pack version listed in a [PackManifest]. */
@ExperimentalPceApi
data class PackManifestEntry(
    val id: String,
    val version: Int,
    val url: String,
    val sha256: String,
    val signature: String,
    val contract: String,
    val minPce: String,
) {
    /** True when [content] matches this entry's declared SHA-256. */
    fun matchesSha256(content: ByteArray): Boolean =
        PackManifest.sha256Hex(content).equals(sha256, ignoreCase = true)
}

@Serializable
private data class ManifestDto(
    val schema: String,
    val generatedAt: String,
    val packs: List<ManifestEntryDto>,
)

@Serializable
private data class ManifestEntryDto(
    val id: String,
    val version: Int,
    val url: String,
    val sha256: String,
    val signature: String,
    val contract: String,
    val minPce: String,
)

@OptIn(ExperimentalPceApi::class)
private fun ManifestEntryDto.toApi(): PackManifestEntry = PackManifestEntry(
    id = id,
    version = version,
    url = url,
    sha256 = sha256,
    signature = signature,
    contract = contract,
    minPce = minPce,
)
