package com.phonecando.runner.appaccess

import com.phonecando.runner.appaccess.ForeignParts.Kind
import com.phonecando.runner.appaccess.ForeignParts.Part
import com.phonecando.runner.appaccess.ForeignParts.Seen
import org.junit.Assert.assertEquals
import org.junit.Test

// Parts of other apps inside a window, as a moto g96 on Android 16 showed
// them: a widget's nodes carry its own app, a notification row is System
// UI's and names its app only in its header.
class ForeignPartsTest {
  private val launcher = "com.motorola.launcher3"
  private val clock = "com.google.android.deskclock"
  private val ui = "com.android.systemui"
  private val apps = mapOf("WhatsApp" to listOf("com.whatsapp"), "Gmail" to listOf("com.google.android.gm"))
  private val named: (String) -> List<String> = { apps[it].orEmpty() }

  private fun node(id: String, parent: String?, pkg: String?, viewId: String? = null, text: String? = null) =
    Seen(id, parent, pkg, viewId, text)

  private val home = listOf(
    node("0", null, launcher),
    node("1", "0", launcher, "$launcher:id/workspace"),
    node("2", "1", launcher, text = null),
    node("3", "2", clock, "$clock:id/themed_root"),
    node("4", "3", clock, "$clock:id/clock", "11:42"),
    node("5", "1", launcher, text = "WhatsApp"),
  )

  // A row: System UI's frame, the framework template, its header's app name.
  private fun row(id: String, parent: String, appName: String?, title: String) = listOfNotNull(
    node(id, parent, ui, "$ui:id/expandableNotificationRow"),
    node("$id.c", id, ui, "android:id/status_bar_latest_event_content"),
    appName?.let { node("$id.n", "$id.c", ui, "android:id/app_name_text", it) },
    node("$id.t", "$id.c", ui, "android:id/title", title),
  )

  @Test fun aWidgetStartsWhereTheAppChanges() {
    assertEquals(listOf(Part("3", Kind.WIDGET, listOf(clock), null)), ForeignParts.find(home, named))
    assertEquals(setOf("3", "4"), ForeignParts.under(home, setOf("3")))
  }

  @Test fun aNotificationRowIsItsAppsByName() {
    val shade = listOf(node("0", null, ui)) + row("r", "0", "WhatsApp", "Mom")
    val parts = ForeignParts.find(shade, named)
    assertEquals(listOf(Part("r", Kind.NOTIFICATION, listOf("com.whatsapp"), "WhatsApp")), parts.filter { it.root == "r" })
    assertEquals(setOf("r", "r.c", "r.n", "r.t"), ForeignParts.under(shade, setOf("r")))
  }

  @Test fun aGroupsRowsTakeTheGroupsName() {
    val shade = listOf(node("0", null, ui)) + row("g", "0", "Gmail", "2 new") + row("k", "g", null, "Invoice")
    val child = ForeignParts.find(shade, named).single { it.root == "k" }
    assertEquals(listOf("com.google.android.gm"), child.packages)
    assertEquals("Gmail", child.label)
  }

  @Test fun aNameNoAppHasHasNoApps() {
    val shade = listOf(node("0", null, ui)) + row("r", "0", "Shell", "PCD check") + row("s", "0", null, "No name")
    val parts = ForeignParts.find(shade, named).filter { it.root == "r" || it.root == "s" }
    assertEquals(listOf(Part("r", Kind.NOTIFICATION, emptyList(), "Shell"), Part("s", Kind.NOTIFICATION, emptyList(), null)), parts)
  }

  @Test fun anAppsOwnScreenHasNoParts() {
    val app = listOf(node("0", null, "com.example.notes"), node("1", "0", "com.example.notes", text = "Hi"), node("2", "1", null))
    assertEquals(emptyList<Part>(), ForeignParts.find(app, named))
    assertEquals(emptySet<String>(), ForeignParts.under(app, emptySet()))
  }
}
