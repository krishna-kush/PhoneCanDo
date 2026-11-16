package com.phonecando.runner.models.measure

import com.phonecando.lme.api.device.CpuCore
import com.phonecando.lme.api.device.DeviceInfo
import com.phonecando.lme.api.model.KvCacheShape
import com.phonecando.lme.api.model.ModelFile
import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.api.model.ModelShape
import com.phonecando.lme.api.model.ModelSource
import com.phonecando.lme.api.serve.MeasuredMemory
import com.phonecando.lme.host.LaunchRequest
import com.phonecando.lme.host.key.ApiKeys
import com.phonecando.lme.host.llamacpp.LlamaCppRuntime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

// A start measures its server first unless what is kept counts its plan,
// and keeps what the dry run said.
class ModelMeasurerTest {
  @get:Rule val tmp = TemporaryFolder()

  private val mib = 1L shl 20
  private val phone = DeviceInfo(
    7_562_532L * 1024, 5L shl 30, "arm64-v8a", List(4) { CpuCore(439, null) } + List(4) { CpuCore(1024, null) },
    setOf("fp", "asimd", "asimdhp", "asimddp"),
  )
  private val small = ModelRecord(
    "qwen3-5-0-8b", "Qwen3.5 0.8B", ModelSource.Imported("q.gguf"), listOf(ModelFile("q.gguf", 532_517_120, "0".repeat(64))),
    ModelShape("qwen35", null, null, null, 262_144, 24, null, KvCacheShape(6_144, 0, null, 5_050_368, quantizable = true)), 0,
  )
  private val kept = HashMap<String, MeasuredMemory>()
  private val runs = mutableListOf<LlamaCppRuntime.Measure>()
  private var answer: (LlamaCppRuntime.Measure, String) -> MeasuredMemory? = { m, tag ->
    MeasuredMemory(tag, m.context, m.halfKvCache, 202 * mib, 549 * mib, 223 * mib, 67 * mib)
  }
  private var told = 0

  private fun measurer(): ModelMeasurer {
    File(tmp.root, "libllama-server.so").writeBytes(ByteArray(7))
    return ModelMeasurer(
      libDir = tmp.root.absolutePath,
      binary = "libllama-server.so",
      device = { phone },
      modelFile = { File(tmp.root, it.entry.name) },
      read = { kept[it] },
      save = { id, m -> kept[id] = m },
      onMeasured = { told++ },
      probe = { m, env, tag ->
        runs += m
        assertEquals(small.id, env["PHONECANDO_MODEL"])
        assertEquals("model-server", env["PHONECANDO_AGENT"])
        answer(m, tag)
      },
      log = {},
    )
  }

  private fun request(measured: MeasuredMemory?) =
    LaunchRequest(small, "/m/q.gguf", "/lib/libllama-server.so", phone, 8099, ApiKeys.newKey(), measured)

  @Test fun aFirstStartMeasuresAndKeepsIt() {
    val m = measurer()
    assertNull(m.known(small))
    val out = m.measured(request(null))
    assertEquals(1, runs.size)
    assertEquals(listOf("--fit", "on", "--log-jsonl"), runs[0].argv.takeLast(3))
    assertEquals(kept[small.id], out.measured)
    assertEquals("cpu=asimd,asimddp,asimdhp,fp;server=7", out.measured!!.phone)
    assertEquals(out.measured, m.known(small))
    assertEquals(1, told)
  }

  @Test fun aStartThatPlansWhatWasMeasuredRunsNoDryRun() {
    val m = measurer()
    val first = m.measured(request(null))
    // Planned with the measurement the context may differ from the estimate's: measured again there, then it holds.
    val second = m.measured(first)
    val third = m.measured(second)
    assertSame(second, third)
    assertTrue(runs.size <= 2)
  }

  @Test fun anotherPhoneOrBuildIsMeasuredAgain() {
    val m = measurer()
    kept[small.id] = MeasuredMemory("cpu=fp;server=7", 32_768, true, 1, 1, 1, 1)
    assertNull(m.known(small))
  }

  @Test fun aDryRunThatSaysNothingLeavesTheEstimate() {
    answer = { _, _ -> null }
    val m = measurer()
    val req = request(null)
    assertSame(req, m.measured(req))
    assertTrue(kept.isEmpty())
    assertEquals(0, told)
  }
}
