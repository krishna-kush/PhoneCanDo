package com.phonecando.runner.appaccess

// Android draws some apps' screens inside another app's window, so a look
// at that window would show them too (uiauto/AppGatedBackend leaves out the
// parts the agent may not see). A widget on the home screen, or a hierarchy
// an app embeds, comes with its own app on every node: a part starts where
// a node's app differs from the app above it. A notification row is System
// UI's on every node, and only its app-name line (the framework header's
// android:id/app_name_text) says whose it is; a group's rows take the
// group's name. A row's apps are every app with that name: none when no app
// has it, and then nobody can be asked about it. Pure.
object ForeignParts {
  enum class Kind { WIDGET, NOTIFICATION }

  /** One node of a look, as found. */
  data class Seen(val id: String, val parent: String?, val pkg: String?, val viewId: String?, val text: String?)

  /** A part of another app: the node it starts at, the apps it may belong to, the name it shows. */
  data class Part(val root: String, val kind: Kind, val packages: List<String>, val label: String?)

  private const val APP_NAME = "android:id/app_name_text"

  // AOSP System UI's row, and the framework template every row wraps.
  private fun isRow(viewId: String?) =
    viewId != null && (viewId.endsWith(":id/expandableNotificationRow") || viewId == "android:id/status_bar_latest_event_content")

  fun find(nodes: List<Seen>, named: (label: String) -> List<String>): List<Part> {
    val byId = nodes.associateBy { it.id }
    fun ancestors(node: Seen) = generateSequence(node.parent?.let(byId::get)) { it.parent?.let(byId::get) }

    val widgets = nodes.mapNotNull { node ->
      val pkg = node.pkg?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
      val above = ancestors(node).firstNotNullOfOrNull { it.pkg?.takeIf(String::isNotBlank) } ?: return@mapNotNull null
      if (pkg == above) null else Part(node.id, Kind.WIDGET, listOf(pkg), null)
    }

    // Each row's name: the first app-name line inside it, else its group's.
    val rows = nodes.filter { isRow(it.viewId) }.map { it.id }.toSet()
    val names = mutableMapOf<String, String>()
    for (line in nodes) {
      val text = line.text?.trim()?.takeIf { line.viewId == APP_NAME && it.isNotEmpty() } ?: continue
      ancestors(line).filter { it.id in rows }.forEach { names.putIfAbsent(it.id, text) }
    }
    val notifications = nodes.filter { it.id in rows }.map { row ->
      val label = names[row.id] ?: ancestors(row).firstNotNullOfOrNull { names[it.id] }
      Part(row.id, Kind.NOTIFICATION, label?.let(named).orEmpty(), label)
    }
    return widgets + notifications
  }

  /** The nodes at or below [roots], which a look leaving those parts out drops. */
  fun under(nodes: List<Seen>, roots: Set<String>): Set<String> {
    if (roots.isEmpty()) return emptySet()
    val byId = nodes.associateBy { it.id }
    val memo = mutableMapOf<String, Boolean>()
    fun dropped(id: String, depth: Int = 0): Boolean = memo.getOrPut(id) {
      // A broken parent chain (or a loop) ends the walk: nothing above it is a root.
      id in roots || (depth < nodes.size && byId[id]?.parent?.let { dropped(it, depth + 1) } == true)
    }
    return nodes.map { it.id }.filterTo(mutableSetOf()) { dropped(it) }
  }
}
