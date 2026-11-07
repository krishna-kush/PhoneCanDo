package com.phonecando.linux.ids

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

// JVM checks for env and image ids: shape, uniqueness, the socket-path budget.
class ShortIdsTest {
  @Test fun idsAreShortLowerCaseAndStartWithALetter() {
    val random = Random(1)
    repeat(500) {
      val id = ShortIds.next(emptySet(), random)
      assertTrue(id, ShortIds.isValid(id))
      assertTrue(id.length <= ShortIds.MAX)
      assertEquals(ShortIds.PREFERRED, id.length)
    }
  }

  @Test fun anIdIsNeverTakenOrReserved() {
    // Every 3-letter id but one is taken: the generator must find the free one.
    val letters = "abcdefghijklmnopqrstuvwxyz"
    val alphabet = letters + "0123456789"
    val all = letters.flatMap { a -> alphabet.flatMap { b -> alphabet.map { c -> "$a$b$c" } } }
    val free = "q7z"
    val taken = all.toSet() - free
    assertEquals(free, ShortIds.next(taken, Random(2)) { it.length == 3 })
  }

  @Test fun theFixedEnvIdsAreReserved() {
    assertTrue("default" in ShortIds.RESERVED)
    assertTrue("android" in ShortIds.RESERVED)
  }

  @Test fun aTightSocketBudgetMakesTheIdShorter() {
    val id = ShortIds.next(emptySet(), Random(3)) { it.length <= 4 }
    assertEquals(4, id.length)
  }

  @Test fun whenNothingFitsWeStillGetTheShortestId() {
    val id = ShortIds.next(emptySet(), Random(4)) { false }
    assertEquals(ShortIds.MIN, id.length)
  }

  @Test fun validityRejectsPathSyntaxAndCase() {
    listOf("", "Abc", "1abc", "a/b", ".abc", "abcdefghi", "ab-c").forEach { assertFalse(it, ShortIds.isValid(it)) }
  }
}
