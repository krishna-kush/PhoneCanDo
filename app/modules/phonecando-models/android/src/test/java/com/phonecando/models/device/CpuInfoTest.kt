package com.phonecando.models.device

import com.phonecando.lme.api.device.CpuCore
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File
import java.nio.file.Files

class CpuInfoTest {
  @Test
  fun `features are what every core has`() {
    val text = """
      processor	: 0
      Features	: fp asimd asimdhp asimddp i8mm
      CPU part	: 0xd05

      processor	: 4
      Features	: fp asimd asimdhp asimddp
      CPU part	: 0xd41
    """.trimIndent()
    assertEquals(setOf("fp", "asimd", "asimdhp", "asimddp"), CpuInfo.features(text))
  }

  @Test
  fun `no features line is no features`() {
    assertEquals(emptySet<String>(), CpuInfo.features("processor : 0\nHardware : x\n"))
  }

  @Test
  fun `cores in order with what the kernel says`() {
    val root = Files.createTempDirectory("cpu").toFile()
    fun core(n: Int, capacity: String?, freq: String?) {
      val dir = File(root, "cpu$n").apply { mkdirs() }
      capacity?.let { File(dir, "cpu_capacity").writeText("$it\n") }
      freq?.let { File(dir, "cpufreq").mkdirs(); File(dir, "cpufreq/cpuinfo_max_freq").writeText(it) }
    }
    core(10, "1024", "2400000")
    core(2, "439", null)
    core(0, null, "garbage")
    File(root, "cpufreq").mkdirs()
    File(root, "possible").writeText("0-7")
    assertEquals(
      listOf(CpuCore(null, null), CpuCore(439, null), CpuCore(1024, 2_400_000)),
      CpuInfo.cores(root),
    )
    root.deleteRecursively()
  }
}
