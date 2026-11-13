package com.phonecando.runner.schedule

import java.security.SecureRandom

// A schedule's id: "s" and 10 base32 characters (50 random bits), short
// enough for a model to repeat in schedule_cancel.
object ScheduleIds {
  private const val ALPHABET = "abcdefghijklmnopqrstuvwxyz234567"
  private const val LENGTH = 10
  private val random = SecureRandom()

  fun next(): String = buildString {
    append('s')
    repeat(LENGTH) { append(ALPHABET[random.nextInt(ALPHABET.length)]) }
  }
}
