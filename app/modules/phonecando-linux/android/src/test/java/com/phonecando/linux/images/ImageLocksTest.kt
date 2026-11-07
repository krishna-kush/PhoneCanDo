package com.phonecando.linux.images

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread

// JVM checks for the per-image lock: one image takes turns, two images run in parallel.
class ImageLocksTest {
  private val locks = ImageLocks()

  @Test fun oneImageTakesTurns() {
    val inside = AtomicInteger()
    val most = AtomicInteger()
    val workers = (1..4).map {
      thread {
        repeat(50) {
          locks.with("a1b2c3") {
            most.accumulateAndGet(inside.incrementAndGet(), ::maxOf)
            Thread.yield()
            inside.decrementAndGet()
          }
        }
      }
    }
    workers.forEach { it.join() }
    assertEquals(1, most.get())
  }

  @Test fun twoImagesDoNotWaitForEachOther() {
    val held = CountDownLatch(1)
    val release = CountDownLatch(1)
    val holder = thread { locks.with("a") { held.countDown(); release.await() } }
    held.await()
    val other = CountDownLatch(1)
    thread { locks.with("b") { other.countDown() } }
    assertTrue(other.await(5, TimeUnit.SECONDS))
    release.countDown()
    holder.join()
  }

  @Test fun itAnswersWhatTheBlockAnswers() {
    assertEquals(42, locks.with("x") { 42 })
  }
}
