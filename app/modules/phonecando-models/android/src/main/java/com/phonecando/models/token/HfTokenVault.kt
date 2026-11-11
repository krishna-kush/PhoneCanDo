package com.phonecando.models.token

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.security.KeyStore
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * The user's Hugging Face token, encrypted at rest: AES-GCM with a key that
 * lives in the Android Keystore and never leaves it, the IV and ciphertext
 * in [file]. Only native code reads it back (HfCatalog, ModelStore.download);
 * JS can set, clear and ask whether one is kept, never read it, and it is
 * never logged. A file the key can never open (a restore to another phone,
 * a key the system dropped) is deleted and reads as no token; any other
 * failure reads as no token this time and keeps the file.
 */
class HfTokenVault(private val file: File) {
  private val lock = Any()

  fun has(): Boolean = synchronized(lock) { file.isFile }

  /** The token, or null when none is kept or it cannot be opened. */
  fun read(): String? = synchronized(lock) {
    if (!file.isFile) return null
    try {
      val bytes = file.readBytes()
      val ivLength = bytes.first().toInt()
      require(ivLength in 12..16 && bytes.size > 1 + ivLength) { "short token file" }
      val iv = bytes.copyOfRange(1, 1 + ivLength)
      val cipher = Cipher.getInstance(TRANSFORMATION)
      cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(TAG_BITS, iv))
      cipher.doFinal(bytes, 1 + ivLength, bytes.size - 1 - ivLength).toString(Charsets.UTF_8)
    } catch (e: Exception) {
      // Only a file this key can never open goes (another phone's key, a dropped key and a new
      // one in its place, a short file); a passing Keystore or disk error keeps it for next time.
      if (e is AEADBadTagException || e is KeyPermanentlyInvalidatedException || e is IllegalArgumentException) file.delete()
      null
    }
  }

  /** Keeps [token] (checked by TokenRules), replacing any earlier one. */
  fun save(token: String) = synchronized(lock) {
    val clean = TokenRules.clean(token)
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, key())
    val iv = cipher.iv
    val sealed = cipher.doFinal(clean.toByteArray(Charsets.UTF_8))
    write(byteArrayOf(iv.size.toByte()) + iv + sealed)
  }

  fun clear() = synchronized(lock) {
    file.delete()
    Unit
  }

  private fun write(bytes: ByteArray) {
    val dir = file.absoluteFile.parentFile ?: throw IOException("no folder for ${file.name}")
    dir.mkdirs()
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

  private fun key(): SecretKey {
    val store = KeyStore.getInstance(KEYSTORE).apply { load(null) }
    (store.getKey(ALIAS, null) as? SecretKey)?.let { return it }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
    generator.init(
      KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build(),
    )
    return generator.generateKey()
  }

  private companion object {
    const val KEYSTORE = "AndroidKeyStore"
    const val ALIAS = "phonecando-hf-token"
    const val TRANSFORMATION = "AES/GCM/NoPadding"
    const val TAG_BITS = 128
  }
}
