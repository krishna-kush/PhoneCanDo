package com.phonecando.lme.gguf.read

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.gguf.testkit.GgufBytes
import com.phonecando.lme.gguf.testkit.GgufBytes.Companion.u32
import com.phonecando.lme.gguf.testkit.GgufBytes.Companion.u64
import com.phonecando.lme.gguf.testkit.Models
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.io.ByteArrayInputStream
import java.io.InputStream
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class GgufReaderTest {
    private fun read(bytes: ByteArray, limits: GgufLimits = GgufLimits.DEFAULT) =
        GgufReader.read(ByteArrayInputStream(bytes), limits)

    @Test
    fun `reads metadata and tensor infos and stops at the data`() {
        val header = Models.qwen35().tensor("token_embd.weight", 2560, 1000).tensor("output_norm.weight", 2560).build()
        val withData = header + ByteArray(1000) { 7 }
        val h = read(withData)

        assertEquals(3, h.version)
        assertEquals(2, h.tensorCount)
        assertEquals("qwen35", h.string("general.architecture"))
        assertEquals(32, h.integer("qwen35.block_count"))
        assertEquals(2_560_000L + 2560, h.parameterCount)
        assertEquals(header.size.toLong(), h.headerBytes)
        assertEquals(GgufValue.Skipped(GgufType.ARRAY, 5000), h.metadata["tokenizer.ggml.tokens"])
    }

    @Test
    fun `version 2 reads like 3, other versions are refused with a reason`() {
        assertEquals(2, read(GgufBytes(version = 2).string("general.architecture", "llama").build()).version)
        assertEquals("GGUF version 1 is no longer supported", invalid(GgufBytes(version = 1).build()))
        assertEquals("a big-endian GGUF file", invalid(GgufBytes(version = 3L shl 24).build()))
        assertEquals("unknown GGUF version 4", invalid(GgufBytes(version = 4).build()))
    }

    @Test
    fun `not a GGUF file`() {
        assertEquals("no GGUF magic", invalid(GgufBytes().apply { magic = "GGML".toByteArray() }.build()))
        assertEquals("the file ends inside its header", invalid(ByteArray(3)))
    }

    @Test
    fun `a truncated header fails at any point`() {
        val bytes = Models.qwen35().tensor("t", 4).build()
        for (cut in listOf(4, 20, 40, 200, bytes.size - 1)) {
            assertEquals("the file ends inside its header", invalid(bytes.copyOf(cut)), "cut at $cut")
        }
    }

    @Test
    fun `every value type reads`() {
        val h = read(
            GgufBytes()
                .entry("u8", 0) { write(200) }
                .entry("i8", 1) { write(0xff) }
                .entry("u16", 2) { write(0xff); write(0xff) }
                .entry("i16", 3) { write(0xfe); write(0xff) }
                .u32("u32", 0xffffffffL)
                .i32("i32", -5)
                .f32("f32", 1.5f)
                .bool("bool", true)
                .u64("u64", 1L shl 40)
                .u64("u64.huge", -1L)
                .entry("i64", 11) { u64(-7) }
                .entry("f64", 12) { u64(2.25.toRawBits()) }
                .u32s("arr", listOf(1, 2, 3))
                .build(),
        )
        assertEquals(200, h.integer("u8"))
        assertEquals(-1, h.integer("i8"))
        assertEquals(65535, h.integer("u16"))
        assertEquals(-2, h.integer("i16"))
        assertEquals(0xffffffffL, h.integer("u32"))
        assertEquals(-5, h.integer("i32"))
        assertEquals(GgufValue.Real(1.5), h.metadata["f32"])
        assertEquals(listOf(1L, 2L, 3L), h.integers("arr"))
        assertEquals(GgufValue.Bool(true), h.metadata["bool"])
        assertEquals(1L shl 40, h.integer("u64"))
        assertIs<GgufValue.Skipped>(h.metadata["u64.huge"])
        assertEquals(-7, h.integer("i64"))
        assertEquals(GgufValue.Real(2.25), h.metadata["f64"])
        assertNull(h.integers("u32"))
        assertNull(h.bools("arr"))
    }

    @Test
    fun `long strings and big arrays are skipped, not kept`() {
        val limits = GgufLimits(keptStringBytes = 8, keptArrayItems = 2)
        val h = read(
            GgufBytes()
                .string("short", "12345678")
                .string("long", "123456789")
                .u32s("small", listOf(1, 2))
                .u32s("big", listOf(1, 2, 3))
                .bools("flags", listOf(true, false, true))
                .string("after", "ok")
                .build(),
            limits,
        )
        assertEquals("12345678", h.string("short"))
        assertEquals(GgufValue.Skipped(GgufType.STRING, 9), h.metadata["long"])
        assertEquals(listOf(1L, 2L), h.integers("small"))
        assertEquals(GgufValue.Skipped(GgufType.ARRAY, 3), h.metadata["big"])
        assertEquals(GgufValue.Skipped(GgufType.ARRAY, 3), h.metadata["flags"])
        assertEquals("ok", h.string("after"))
    }

    @Test
    fun `counts and lengths past the limits fail before anything is allocated`() {
        assertThrows<LmeException.TooLarge> { read(GgufBytes().apply { kvCount = 1L shl 40 }.build()) }
        assertThrows<LmeException.TooLarge> { read(GgufBytes().apply { tensorCount = -1 }.build()) }
        assertThrows<LmeException.TooLarge> {
            read(GgufBytes().entry("s", GgufBytes.STRING) { u64(1L shl 62) }.build())
        }
        assertThrows<LmeException.TooLarge> {
            read(GgufBytes().entry("a", GgufBytes.ARRAY) { u32(4); u64(1L shl 40) }.build())
        }
        // Skipping still counts against the header budget.
        assertThrows<LmeException.TooLarge> {
            read(Models.qwen35().build(), GgufLimits(headerBytes = 10_000, keptArrayItems = 10))
        }
        assertEquals(
            "a key longer than 4 bytes",
            invalid(GgufBytes().string("toolong", "x").build(), GgufLimits(keyBytes = 4)),
        )
    }

    @Test
    fun `malformed entries are named`() {
        assertEquals("an empty metadata key", invalid(GgufBytes().string("", "x").build()))
        assertEquals("unknown value type 13", invalid(GgufBytes().entry("k", 13) {}.build()))
        assertEquals("metadata key k twice", invalid(GgufBytes().u32("k", 1).u32("k", 2).build()))
        assertEquals("a bool that is neither 0 nor 1", invalid(GgufBytes().entry("b", GgufBytes.BOOL) { write(2) }.build()))
        assertEquals(
            "an array of arrays",
            invalid(GgufBytes().entry("a", GgufBytes.ARRAY) { u32(GgufBytes.ARRAY.toLong()); u64(1) }.build()),
        )
        assertEquals(
            "an array of arrays",
            invalid(
                GgufBytes().entry("a", GgufBytes.ARRAY) { u32(GgufBytes.ARRAY.toLong()); u64(9000) }.build(),
                GgufLimits(keptArrayItems = 10),
            ),
        )
    }

    @Test
    fun `tensor infos are checked`() {
        assertEquals("a tensor with 5 dimensions", invalid(GgufBytes().tensor("t", 1, 1, 1, 1, 1).build()))
        assertEquals("a tensor with 0 dimensions", invalid(GgufBytes().tensor("t").build()))
        assertEquals("a tensor name longer than 63 bytes", invalid(GgufBytes().tensor("n".repeat(64), 1).build()))
        assertEquals("a tensor dimension out of range", invalid(GgufBytes().tensor("t", -1).build()))
        assertEquals("a size out of range", invalid(GgufBytes().tensor("t", 1L shl 40, 1L shl 40).build()))
    }

    @Test
    fun `a stream that skips little still gets read through`() {
        val bytes = Models.qwen35().build()
        val stingy = object : InputStream() {
            private val inner = ByteArrayInputStream(bytes)
            override fun read() = inner.read()
            override fun read(b: ByteArray, off: Int, len: Int) = inner.read(b, off, minOf(len, 3))
            override fun skip(n: Long) = 0L
        }
        assertTrue(GgufReader.read(stingy).has("general.file_type"))
    }

    private fun invalid(bytes: ByteArray, limits: GgufLimits = GgufLimits.DEFAULT): String =
        assertThrows<LmeException.InvalidGguf> { read(bytes, limits) }.reason
}
