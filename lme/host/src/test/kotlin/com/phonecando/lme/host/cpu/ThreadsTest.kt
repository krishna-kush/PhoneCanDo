package com.phonecando.lme.host.cpu

import com.phonecando.lme.api.device.CpuCore
import com.phonecando.lme.host.support.Phones
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class ThreadsTest {
    @Test
    fun `big cores by capacity`() {
        assertEquals(4, Threads.pick(Phones.MOTO_G96.cores))
        // 1 prime + 3 big + 4 little
        assertEquals(4, Threads.pick(listOf(CpuCore(1024, null)) + List(3) { CpuCore(870, null) } + List(4) { CpuCore(400, null) }))
        assertEquals(8, Threads.pick(List(8) { CpuCore(1024, null) }))
    }

    @Test
    fun `by frequency when a capacity is missing, else every core`() {
        val cores = List(4) { CpuCore(null, 1_500_000) } + List(2) { CpuCore(1024, 2_400_000) }
        assertEquals(2, Threads.pick(cores))
        assertEquals(6, Threads.pick(List(6) { CpuCore(null, null) }))
        assertEquals(3, Threads.pick(List(3) { CpuCore(0, 0) }))
        assertEquals(1, Threads.pick(emptyList()))
    }
}
