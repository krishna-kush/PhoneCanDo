package com.phonecando.lre.image.proc

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class FakeProcTest {
    @Test
    fun `stat lists the host cpu ids and its aggregate is their sum`() {
        val stat = FakeProc.stat(listOf(0, 1, 2, 4, 5, 6, 7))
        val lines = stat.lines()
        val cpus = lines.filter { it.startsWith("cpu") && !it.startsWith("cpu ") }
        assertEquals(listOf("cpu0", "cpu1", "cpu2", "cpu4", "cpu5", "cpu6", "cpu7"), cpus.map { it.substringBefore(' ') })
        val total = lines.first().removePrefix("cpu").trim().split(' ').map { it.toLong() }
        val sum = cpus.map { line -> line.substringAfter(' ').split(' ').map { it.toLong() } }
            .reduce { a, b -> a.zip(b) { x, y -> x + y } }
        assertEquals(sum, total)
        assertTrue(stat.contains("\nbtime "))
    }

    @Test
    fun `uptime idle agrees with the stat idle column`() {
        val ids = listOf(0, 1, 2, 3, 4)
        val idleTicks = FakeProc.stat(ids).lines().first().removePrefix("cpu").trim().split(' ')[3].toLong()
        val (up, idle) = FakeProc.uptime(ids).trim().split(' ')
        assertEquals("3600.00", up)
        assertEquals(idleTicks / 100.0, idle.toDouble(), 0.001)
    }

    @Test
    fun `every cpu row adds up to the uptime`() {
        FakeProc.stat(listOf(0, 1, 2, 3)).lines().filter { it.matches(Regex("cpu\\d+ .*")) }.forEach { line ->
            assertEquals(360_000L, line.substringAfter(' ').split(' ').sumOf { it.toLong() })
        }
    }

    @Test
    fun `files cover every bound name, the version names our kernel and the hostname is the image's`() {
        val files = FakeProc.files(emptyList(), "debian")
        assertEquals(FakeProc.NAMES.toSet(), files.keys)
        assertTrue(files.getValue("version").startsWith("Linux version ${FakeProc.KERNEL_RELEASE} "))
        assertTrue(files.getValue("version").endsWith(" ${FakeProc.KERNEL_VERSION}\n"))
        assertEquals("debian\n", files["sys/kernel/hostname"])
        assertTrue(files.getValue("stat").contains("\ncpu0 "))
        files.values.forEach { assertTrue(it.endsWith("\n")) }
    }

    @Test
    fun `cpuinfo parsing keeps gaps`() {
        val cpuinfo = "processor\t: 0\nBogoMIPS\t: 38.40\n\nprocessor\t: 2\nprocessor : 7\n"
        assertEquals(listOf(0, 2, 7), CpuIds.parse(cpuinfo))
        assertEquals(emptyList(), CpuIds.parse("Hardware : x\n"))
    }
}
