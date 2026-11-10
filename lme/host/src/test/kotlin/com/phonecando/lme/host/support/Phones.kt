package com.phonecando.lme.host.support

import com.phonecando.lme.api.device.CpuCore
import com.phonecando.lme.api.device.DeviceInfo
import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.api.model.ModelFile
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.model.ModelShape
import com.phonecando.lme.api.model.ModelSource

/** Phones by the total RAM they report, and the suggested models as records. */
object Phones {
    private const val GIB = 1L shl 30

    /** Our test phone, Moto g96 (8 GB): MemTotal 7562532 kB, 4 little + 4 big cores. */
    val MOTO_G96 = DeviceInfo(
        totalRamBytes = 7_562_532L * 1024,
        availableRamBytes = 2_825_608L * 1024,
        abi = "arm64-v8a",
        cores = List(4) { CpuCore(439, 1_958_400) } + List(4) { CpuCore(1024, 2_400_000) },
        cpuFeatures = "fp asimd evtstrm aes pmull sha1 sha2 crc32 atomics fphp asimdhp cpuid asimdrdm lrcpc dcpop asimddp"
            .split(' ').toSet(),
    )

    /** Our test phone with little else running: more free than its budget, so the budget is the bound. */
    val MOTO_G96_IDLE = MOTO_G96.copy(availableRamBytes = 5 * GIB)

    /** A phone reporting [gib] of RAM with [freeGib] free (by default all of it: the budget is the bound). */
    fun withRam(gib: Double, freeGib: Double = gib) =
        MOTO_G96.copy(totalRamBytes = (gib * GIB).toLong(), availableRamBytes = (freeGib * GIB).toLong())

    fun model(id: String, bytes: Long, kv: KvCacheShape, contextLength: Long?) = ModelRecord(
        id = id,
        name = id,
        source = ModelSource.Imported("$id.gguf"),
        files = listOf(ModelFile("$id.gguf", bytes, "0".repeat(64))),
        shape = ModelShape("arch", id, "Q4_K_M", null, contextLength, 32, null, kv),
        addedAtMillis = 0,
    )

    val QWEN_4B = model("qwen3-5-4b-q4-k-m", 2_740_937_888, KvCacheShape(16_384, 0, null), 262_144)
    val GEMMA_E2B = model("gemma-4-e2b-it-q4-k-m", 3_106_738_272, KvCacheShape(3_072, 6_144, 512), 131_072)
    val QWEN_9B = model("qwen3-5-9b-q4-k-m", 5_680_522_464, KvCacheShape(16_384, 0, null), 262_144)
    val QWEN_08B = model("qwen3-5-0-8b-q4-k-m", 532_517_120, KvCacheShape(6_144, 0, null), 262_144)
}
