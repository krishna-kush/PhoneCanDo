package com.phonecando.lre.oci.blob

import com.phonecando.lre.api.LreException

/**
 * A validated `sha256:<hex>` content digest. Digests come from untrusted
 * manifests and name files on disk, so only exact lower-case hex passes.
 */
internal data class Digest(val hex: String) {
    /** The blob's file name in a download dir: `sha256-<hex>`. */
    val fileName: String get() = "$ALGORITHM-$hex"

    override fun toString(): String = "$ALGORITHM:$hex"

    companion object {
        const val ALGORITHM = "sha256"
        private val HEX = Regex("[a-f0-9]{64}")

        /**
         * @throws LreException.UnsupportedLayer for any algorithm but sha256.
         * @throws LreException.Corrupt for a malformed digest.
         */
        fun parse(digest: String): Digest {
            val colon = digest.indexOf(':')
            if (colon <= 0) throw LreException.Corrupt("digest ${digest.take(80)}")
            val algorithm = digest.substring(0, colon)
            if (algorithm != ALGORITHM) throw LreException.UnsupportedLayer("digest algorithm ${algorithm.take(32)}")
            val hex = digest.substring(colon + 1)
            if (!HEX.matches(hex)) throw LreException.Corrupt("digest ${digest.take(80)}")
            return Digest(hex)
        }
    }
}
