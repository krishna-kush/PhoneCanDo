package com.phonecando.linux.ids

import kotlin.random.Random

/**
 * Ids for envs and images: lower-case letters and digits, a letter first,
 * at most [MAX] characters. An image id is a path part of every socket
 * under its home/ and tmp/ (108-byte sun_path cap), so we start at
 * [PREFERRED] and go shorter while [fits] says the paths would be tight.
 * Pure.
 */
object ShortIds {
  const val MAX = 8
  const val PREFERRED = 6
  const val MIN = 3

  private const val LETTERS = "abcdefghijklmnopqrstuvwxyz"
  private const val ALPHABET = LETTERS + "0123456789"

  /** Ids we never hand out at random: the fixed Default and Android env ids. */
  val RESERVED = setOf("default", "android")

  private val SHAPE = Regex("[a-z][a-z0-9]{0,${MAX - 1}}")

  fun isValid(id: String): Boolean = SHAPE.matches(id)

  /**
   * A fresh id not in [taken] (nor [RESERVED]). The longest length from
   * [PREFERRED] down to [MIN] whose id [fits]; when none fits, a [MIN]-long
   * one (setup then reports the paths as tight).
   */
  fun next(taken: Set<String>, random: Random = Random.Default, fits: (String) -> Boolean = { true }): String {
    for (length in PREFERRED downTo MIN) {
      val id = fresh(length, taken, random)
      if (fits(id)) return id
    }
    return fresh(MIN, taken, random)
  }

  private fun fresh(length: Int, taken: Set<String>, random: Random): String {
    while (true) {
      val id = buildString {
        append(LETTERS[random.nextInt(LETTERS.length)])
        repeat(length - 1) { append(ALPHABET[random.nextInt(ALPHABET.length)]) }
      }
      if (id !in taken && id !in RESERVED) return id
    }
  }
}
