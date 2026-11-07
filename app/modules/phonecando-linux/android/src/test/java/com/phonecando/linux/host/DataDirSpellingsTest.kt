package com.phonecando.linux.host

import org.junit.Assert.assertEquals
import org.junit.Test

// JVM checks for the data-dir spellings image setup binds and lists as `same` paths.
class DataDirSpellingsTest {
  private val pkg = "com.phonecando.app.full.dev"

  @Test fun theFirstUserHasTheLegacySpellingFirst() {
    assertEquals(
      listOf("/data/data/$pkg", "/data/user/0/$pkg"),
      DataDirSpellings.of(pkg, "/data/user/0/$pkg", uid = 10_123),
    )
  }

  @Test fun aSecondaryUserHasOnlyItsOwnDataDir() {
    assertEquals(listOf("/data/user/10/$pkg"), DataDirSpellings.of(pkg, "/data/user/10/$pkg", uid = 1_010_123))
  }

  @Test fun adoptableStorageHasOnlyItsOwnDataDir() {
    val moved = "/mnt/expand/0a1b2c3d-1111-2222-3333-444455556666/user/0/$pkg"
    assertEquals(listOf(moved), DataDirSpellings.of(pkg, moved, uid = 10_123))
  }

  @Test fun spellingsAreDistinctAndWithoutATrailingSlash() {
    assertEquals(listOf("/data/data/$pkg"), DataDirSpellings.of(pkg, "/data/data/$pkg/", uid = 10_123))
  }
}
