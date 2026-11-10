package com.phonecando.lme.gguf.testkit

import java.io.ByteArrayOutputStream

/**
 * Builds GGUF headers byte by byte, little-endian, for tests. Counts are
 * written as given ([kvCount] / [tensorCount] override them to lie).
 */
class GgufBytes(private val version: Long = 3) {
    private val kvs = ByteArrayOutputStream()
    private val tensors = ByteArrayOutputStream()
    private var kvTotal = 0L
    private var tensorTotal = 0L
    var magic = byteArrayOf('G'.code.toByte(), 'G'.code.toByte(), 'U'.code.toByte(), 'F'.code.toByte())
    var kvCount: Long? = null
    var tensorCount: Long? = null

    fun string(key: String, value: String) = entry(key, STRING) { str(value) }

    fun u32(key: String, value: Long) = entry(key, UINT32) { u32(value) }

    fun i32(key: String, value: Int) = entry(key, INT32) { u32(value.toLong() and 0xffffffffL) }

    fun u64(key: String, value: Long) = entry(key, UINT64) { u64(value) }

    fun f32(key: String, value: Float) = entry(key, FLOAT32) { u32(value.toRawBits().toLong() and 0xffffffffL) }

    fun bool(key: String, value: Boolean) = entry(key, BOOL) { write(if (value) 1 else 0) }

    fun u32s(key: String, values: List<Long>) = entry(key, ARRAY) {
        u32(UINT32.toLong())
        u64(values.size.toLong())
        values.forEach { u32(it) }
    }

    fun bools(key: String, values: List<Boolean>) = entry(key, ARRAY) {
        u32(BOOL.toLong())
        u64(values.size.toLong())
        values.forEach { write(if (it) 1 else 0) }
    }

    /** An array of [count] strings of [length] bytes each (a tokenizer stand-in). */
    fun strings(key: String, count: Int, length: Int) = entry(key, ARRAY) {
        u32(STRING.toLong())
        u64(count.toLong())
        repeat(count) { str("t".repeat(length)) }
    }

    /** Raw entry: [type] then whatever [body] writes. */
    fun entry(key: String, type: Int, body: ByteArrayOutputStream.() -> Unit): GgufBytes {
        kvs.str(key)
        kvs.u32(type.toLong())
        kvs.body()
        kvTotal++
        return this
    }

    fun tensor(name: String, vararg dims: Long): GgufBytes {
        tensors.str(name)
        tensors.u32(dims.size.toLong())
        dims.forEach { tensors.u64(it) }
        tensors.u32(12) // Q4_K
        tensors.u64(0)
        tensorTotal++
        return this
    }

    fun build(): ByteArray = ByteArrayOutputStream().apply {
        write(magic)
        u32(version)
        u64(tensorCount ?: tensorTotal)
        u64(kvCount ?: kvTotal)
        write(kvs.toByteArray())
        write(tensors.toByteArray())
    }.toByteArray()

    companion object {
        const val UINT32 = 4
        const val INT32 = 5
        const val FLOAT32 = 6
        const val BOOL = 7
        const val STRING = 8
        const val ARRAY = 9
        const val UINT64 = 10

        fun ByteArrayOutputStream.u32(v: Long) = repeat(4) { write(((v shr (8 * it)) and 0xff).toInt()) }

        fun ByteArrayOutputStream.u64(v: Long) = repeat(8) { write(((v shr (8 * it)) and 0xff).toInt()) }

        fun ByteArrayOutputStream.str(s: String) {
            val bytes = s.toByteArray()
            u64(bytes.size.toLong())
            write(bytes)
        }
    }
}
