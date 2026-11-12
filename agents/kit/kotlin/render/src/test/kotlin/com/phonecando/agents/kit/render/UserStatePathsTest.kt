package com.phonecando.agents.kit.render

import com.phonecando.agents.kit.manifest.ManifestDecoder
import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

// A kind's userState: the paths the host deletes when an agent that kept
// the kind's defaults leaves a machine that stays, and what of() refuses.
class UserStatePathsTest {
  private fun kind(userState: String?) = ManifestKind.of(
    ManifestDecoder.decode(
      """{"schema":1,"id":"demo","label":"Demo","version":"1","type":"image","channels":["full"],"stability":"preview",
         "requires":{"linux":"required"},"engine":{"style":"tui","launch":{"argv":["demo"]}}""" +
        (userState?.let { ""","userState":$it}""" } ?: "}"),
    ),
    null,
  )

  @Test fun pathsInHome() {
    val k = kind("""[".demo", ".demo.json", ".config/demo", ".local/share/demo"]""")
    assertEquals(
      listOf("/i/home/.demo", "/i/home/.demo.json", "/i/home/.config/demo", "/i/home/.local/share/demo").map(::File),
      k.userStatePaths(File("/i/home")),
    )
    assertEquals(emptyList(), kind(null).userStatePaths(File("/i/home")))
  }

  @Test fun neverWhatTheMachineShares() {
    val shared = listOf(
      "projects", "projects/x", ".phonecando", ".phonecando/agents/a2", ".ssh", ".gitconfig", ".config/git", ".local",
      ".local/bin", ".local/opt/node", ".local/share/uv/tools", ".config", ".cache", ".local/share", ".local/state", ".bashrc",
    )
    for (path in shared) assertTrue(UserStatePaths.problem(path).orEmpty().startsWith("would take "), path)
    assertEquals("would take .local/bin, which the machine's agents share", UserStatePaths.problem(".local"))
    for (path in listOf("/root/.demo", "../x", ".demo/", "./x", "a//b", "a\\b", "")) {
      assertEquals("is not a plain path in HOME", UserStatePaths.problem(path), path)
    }
    for (path in listOf(".demo", ".config/demo", ".local/share/demo", ".local/state/demo", ".cache/demo", ".pi/agent", "projectsx")) {
      assertNull(UserStatePaths.problem(path), path)
    }
  }

  @Test fun refusesAKindThatWouldDeleteSharedThings() {
    assertEquals(
      "demo: userState .local would take .local/bin, which the machine's agents share",
      assertFailsWith<KindException> { kind("""[".demo", ".local"]""") }.message,
    )
    assertEquals(
      "demo: userState /root/.demo is not a plain path in HOME",
      assertFailsWith<KindException> { kind("""["/root/.demo"]""") }.message,
    )
  }
}
