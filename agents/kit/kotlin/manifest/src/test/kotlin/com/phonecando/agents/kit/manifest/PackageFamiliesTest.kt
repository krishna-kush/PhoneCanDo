package com.phonecando.agents.kit.manifest

import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// The kit's package families are lre-api's PackageFamily ids, name for name:
// the family lre detects in an image is the one an install is rendered for.
// Reads lre's source (lre/api OsInfo.kt), so a family added there fails here
// until the kit knows it (the TS side has families.test.ts).
class PackageFamiliesTest {
  private val osInfo = File(checkNotNull(System.getProperty("phonecando.lreOsInfo")))

  @Test fun areLreApisPackageFamilyIds() {
    val body = Regex("""enum\s+class\s+PackageFamily\b[^{]*\{([^}]*)}""").find(osInfo.readText())?.groupValues?.get(1)
    val ids = Regex("""\b[A-Z][A-Z0-9_]*\s*\(\s*"([^"]+)"\s*\)""").findAll(checkNotNull(body) { "no PackageFamily in $osInfo" })
      .map { it.groupValues[1] }.toList()
    assertTrue(ids.isNotEmpty())
    assertEquals(ids.sorted(), PackageFamilies.ALL.sorted())
  }
}
