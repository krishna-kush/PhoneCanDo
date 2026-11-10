package com.phonecando.lme.gguf.read

import com.phonecando.lme.api.LmeException
import java.io.BufferedInputStream
import java.io.InputStream

/**
 * Reads the header of a GGUF file (versions 2 and 3, little-endian): the
 * magic, the metadata key/values and the tensor infos, and stops there; the
 * tensor data is never read. Every count and length is checked against
 * [GgufLimits] before it is used, so a broken file costs at most
 * [GgufLimits.headerBytes] of reading. Pure apart from reading [input].
 */
object GgufReader {
    private const val MAGIC = 0x46554747L // "GGUF" read as a little-endian u32
    private const val MAX_DIMS = 4 // GGML_MAX_DIMS
    private const val MAX_TENSOR_NAME = 63 // GGML_MAX_NAME minus the NUL

    /**
     * @throws LmeException.InvalidGguf when it is not a GGUF file we can read
     * @throws LmeException.TooLarge when the header passes a limit
     */
    fun read(input: InputStream, limits: GgufLimits = GgufLimits.DEFAULT): GgufHeader {
        val buffered = if (input is BufferedInputStream) input else BufferedInputStream(input, 64 * 1024)
        val le = LittleEndianInput(buffered, limits.headerBytes)
        if (le.u32() != MAGIC) throw LmeException.InvalidGguf("no GGUF magic")
        val version = version(le.u32())
        val tensorCount = count(le.u64(), limits.tensors, "tensor count")
        val entryCount = count(le.u64(), limits.metadataEntries, "metadata count")

        val metadata = LinkedHashMap<String, GgufValue>()
        repeat(entryCount.toInt()) {
            val key = text(le, limits.keyBytes, "key")
            if (key.isEmpty()) throw LmeException.InvalidGguf("an empty metadata key")
            val type = type(le.u32())
            if (metadata.put(key, value(le, type, limits, nested = false)) != null) {
                throw LmeException.InvalidGguf("metadata key $key twice")
            }
        }

        var parameters = 0L
        repeat(tensorCount.toInt()) {
            text(le, MAX_TENSOR_NAME.toLong(), "tensor name")
            val dims = le.u32()
            if (dims !in 1..MAX_DIMS) throw LmeException.InvalidGguf("a tensor with $dims dimensions")
            var elements = 1L
            repeat(dims.toInt()) {
                val n = le.u64()
                if (n < 0) throw LmeException.InvalidGguf("a tensor dimension out of range")
                elements = multiply(elements, n)
            }
            le.u32() // ggml type
            le.u64() // data offset
            parameters = add(parameters, elements)
        }
        return GgufHeader(version.toInt(), tensorCount, metadata, parameters, le.position)
    }

    private fun version(raw: Long): Long = when {
        raw == 2L || raw == 3L -> raw
        raw == 1L -> throw LmeException.InvalidGguf("GGUF version 1 is no longer supported")
        raw and 0xffff == 0L -> throw LmeException.InvalidGguf("a big-endian GGUF file")
        else -> throw LmeException.InvalidGguf("unknown GGUF version $raw")
    }

    private fun count(raw: Long, limit: Long, what: String): Long {
        if (raw < 0 || raw > limit) throw LmeException.TooLarge("GGUF $what", limit)
        return raw
    }

    private fun type(raw: Long): GgufType = GgufType.of(raw) ?: throw LmeException.InvalidGguf("unknown value type $raw")

    private fun value(le: LittleEndianInput, type: GgufType, limits: GgufLimits, nested: Boolean): GgufValue = when (type) {
        GgufType.UINT8 -> GgufValue.Integer(le.u8().toLong())
        GgufType.INT8 -> GgufValue.Integer(le.u8().toByte().toLong())
        GgufType.UINT16 -> GgufValue.Integer(le.u16().toLong())
        GgufType.INT16 -> GgufValue.Integer(le.u16().toShort().toLong())
        GgufType.UINT32 -> GgufValue.Integer(le.u32())
        GgufType.INT32 -> GgufValue.Integer(le.u32().toInt().toLong())
        GgufType.UINT64 -> le.u64().let { if (it < 0) GgufValue.Skipped(type, 1) else GgufValue.Integer(it) }
        GgufType.INT64 -> GgufValue.Integer(le.u64())
        GgufType.FLOAT32 -> GgufValue.Real(Float.fromBits(le.u32().toInt()).toDouble())
        GgufType.FLOAT64 -> GgufValue.Real(Double.fromBits(le.u64()))
        GgufType.BOOL -> when (le.u8()) {
            0 -> GgufValue.Bool(false)
            1 -> GgufValue.Bool(true)
            else -> throw LmeException.InvalidGguf("a bool that is neither 0 nor 1")
        }
        GgufType.STRING -> {
            val length = count(le.u64(), limits.stringBytes, "string")
            if (length > limits.keptStringBytes) {
                le.skip(length)
                GgufValue.Skipped(type, length)
            } else {
                GgufValue.Text(decode(le.bytes(length.toInt())))
            }
        }
        GgufType.ARRAY -> {
            if (nested) throw LmeException.InvalidGguf("an array of arrays")
            val elementType = type(le.u32())
            val items = count(le.u64(), limits.arrayItems, "array")
            if (items > limits.keptArrayItems) {
                skipItems(le, elementType, items, limits)
                GgufValue.Skipped(GgufType.ARRAY, items)
            } else {
                GgufValue.Items(elementType, List(items.toInt()) { value(le, elementType, limits, nested = true) })
            }
        }
    }

    private fun skipItems(le: LittleEndianInput, elementType: GgufType, items: Long, limits: GgufLimits) {
        when (elementType) {
            GgufType.STRING -> times(items) { le.skip(count(le.u64(), limits.stringBytes, "string")) }
            GgufType.ARRAY -> throw LmeException.InvalidGguf("an array of arrays")
            // A bool array still has to hold 0 or 1 in every byte; reading
            // it item by item checks that.
            GgufType.BOOL -> times(items) { value(le, elementType, limits, nested = true) }
            else -> le.skip(multiply(items, elementType.size.toLong()))
        }
    }

    private inline fun times(n: Long, action: () -> Unit) {
        var i = 0L
        while (i < n) {
            action()
            i++
        }
    }

    private fun text(le: LittleEndianInput, limit: Long, what: String): String {
        val length = le.u64()
        if (length < 0 || length > limit) throw LmeException.InvalidGguf("a $what longer than $limit bytes")
        return decode(le.bytes(length.toInt()))
    }

    private fun decode(bytes: ByteArray): String = String(bytes, Charsets.UTF_8)

    private fun multiply(a: Long, b: Long): Long = try {
        Math.multiplyExact(a, b)
    } catch (_: ArithmeticException) {
        throw LmeException.InvalidGguf("a size out of range")
    }

    private fun add(a: Long, b: Long): Long = try {
        Math.addExact(a, b)
    } catch (_: ArithmeticException) {
        throw LmeException.InvalidGguf("a size out of range")
    }
}
