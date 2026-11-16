package com.phonecando.lme.host.llamacpp

import com.phonecando.lme.api.LmeException
import com.phonecando.lme.api.model.KvCacheChoice
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.model.ServeChoices
import com.phonecando.lme.api.serve.MeasuredMemory
import com.phonecando.lme.host.LaunchRequest
import com.phonecando.lme.host.chats.ChatStorage
import com.phonecando.lme.host.chats.StoredChats
import com.phonecando.lme.host.key.ApiKeys
import com.phonecando.lme.host.ram.RamGate
import com.phonecando.lme.host.ram.RamVerdict
import com.phonecando.lme.host.ram.ServerMemory
import com.phonecando.lme.host.support.Phones
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

/** The plan with what the server holds besides the prompt (measured or estimated) and with chats kept on storage. */
class MeasuredPlanTest {
    private val key = ApiKeys.newKey()
    private val mib = 1L shl 20
    private val gib = 1L shl 30
    private val chats = "/data/user/0/app/files/models/m/.chats"

    /** What the 0.8B measured on our test phone at 32k with 8-bit notes. */
    private val small = MeasuredMemory("tag", 32_768, true, 202 * mib, 549 * mib, 223 * mib, 67 * mib)

    private fun request(model: ModelRecord, measured: MeasuredMemory?, storageFree: Long? = null) = LaunchRequest(
        model, "/m/${model.entry.name}", "/lib/libllama-server.so", Phones.MOTO_G96_IDLE, 8099, key, measured,
        storageFree?.let { ChatStorage(chats, it) },
    )

    @Test
    fun `measured, the 0_8B at 32k with 8-bit notes needs what the phone saw, and holds all but the pages it reads in place`() {
        val model = Phones.QWEN_08B.copy(context = 32_768, serve = ServeChoices(kvCache = KvCacheChoice.HALF, savedPrompts = 0))
        val plan = LlamaCppRuntime.contextPlan(Phones.MOTO_G96_IDLE, model, small)
        // 751 MiB of weights, 67 MiB of compute, 8-bit KV cache (204 MiB), the recurrent state and 4 checkpoints (96 MiB).
        assertEquals(1_172_652_032, plan.needBytes)
        assertEquals(1118, plan.needBytes / mib)
        assertTrue(plan.measured)
        assertEquals(67 * mib, plan.computeBytes)
        assertEquals(plan.totalBytes - 202 * mib, plan.heldBytes)
        // Its plan before (the files and the state alone) counted 808 MiB.
        val files = LlamaCppRuntime.contextPlan(
            Phones.MOTO_G96_IDLE, model.sizeBytes, model.shape.kvCache, model.shape.contextLength, 32_768, model.serve, ServerMemory.filesOnly(model.sizeBytes),
        )
        assertEquals(808, files.needBytes / mib)
    }

    @Test
    fun `before a measurement the estimate counts more than the phone measured`() {
        val model = Phones.QWEN_08B.copy(context = 32_768, serve = ServeChoices(kvCache = KvCacheChoice.HALF))
        val estimate = LlamaCppRuntime.contextPlan(Phones.MOTO_G96_IDLE, model)
        assertFalse(estimate.measured)
        assertTrue(estimate.needBytes > LlamaCppRuntime.contextPlan(Phones.MOTO_G96_IDLE, model, small).needBytes)
        // Held: all but the files' pages, so the estimated copies count as taken from free memory.
        assertEquals(estimate.totalBytes - model.sizeBytes, estimate.heldBytes)
    }

    @Test
    fun `a measurement past the files plans a smaller context, or refuses what no context fits`() {
        val phone = Phones.withRam(15.0)
        val four = Phones.QWEN_4B
        val files = MeasuredMemory("tag", 1, false, four.sizeBytes, 0, 0, 0)
        val before = LlamaCppRuntime.contextPlan(phone, four, files)
        assertEquals(45_056, before.context)
        // Half its layers copied again, and a compute buffer: less context, still within the budget.
        val copied = MeasuredMemory("tag", 32_768, false, 600 * mib, 2_600 * mib, 0, 150 * mib)
        val after = LlamaCppRuntime.contextPlan(phone, four, copied)
        assertTrue(after.context < before.context)
        assertTrue(after.needBytes <= RamGate.budget(phone.totalRamBytes))
        assertIs<RamVerdict.Fits>(after.ram)
        // On our 8 GB phone the same copies leave no context within the budget: refused, not left to the memory guard.
        val e = assertThrows<LmeException.NotEnoughMemory> { LlamaCppRuntime.plan(request(four, copied)) }
        assertTrue(e.needed > e.budget)
    }

    @Test
    fun `with room on storage chats go there, the prompt cache gets nothing and the context its room`() {
        val model = Phones.QWEN_08B
        val ram = LlamaCppRuntime.plan(request(model, small))
        assertEquals(0, ram.storedChats)
        assertFalse("--slot-save-path" in ram.argv)
        val stored = LlamaCppRuntime.plan(request(model, small, storageFree = 8 * gib))
        assertEquals(StoredChats.MOST, stored.storedChats)
        assertEquals(0, stored.promptCacheMiB)
        assertEquals(listOf("--cache-ram", "0", "--slot-save-path", chats), stored.argv.takeLast(4))
        assertTrue(stored.contextSize >= ram.contextSize)
        val plan = LlamaCppRuntime.contextPlan(Phones.MOTO_G96_IDLE, model, small, 8 * gib)
        assertEquals(0, plan.savedPrompts)
        assertEquals(StoredChats.MOST, plan.storedChats)
        // Storage short of a chat above the margin: chats stay in RAM, as without storage.
        val short = LlamaCppRuntime.plan(request(model, small, storageFree = gib))
        assertEquals(0, short.storedChats)
        assertEquals(ram.argv, short.argv)
    }

    @Test
    fun `the dry run measures what a start would run, whatever the gate says`() {
        val nine = Phones.QWEN_9B
        assertThrows<LmeException.NotEnoughMemory> { LlamaCppRuntime.plan(request(nine, null)) }
        val dry = LlamaCppRuntime.measure(request(nine, null))
        assertEquals(16_384, dry.context)
        assertTrue(dry.halfKvCache)
        assertEquals(listOf("--port", "0"), dry.argv.subList(dry.argv.indexOf("--port"), dry.argv.indexOf("--port") + 2))
        assertEquals(listOf("--fit", "on", "--log-jsonl"), dry.argv.takeLast(3))
        assertEquals(mapOf(LlamaCppRuntime.KEY_ENV to key), dry.env)
        assertFalse(key in dry.toString())
        // With chats on storage the dry run leaves the dir out.
        assertFalse("--slot-save-path" in LlamaCppRuntime.measure(request(Phones.QWEN_08B, small, storageFree = 8 * gib)).argv)
    }
}
