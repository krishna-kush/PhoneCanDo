package com.phonecando.runner.engine.image

import com.phonecando.agents.kit.AgentKind
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.engine.events.KitFiles
import com.phonecando.runner.messages.delivery.InboxFolder
import java.io.File
import java.io.IOException
import java.nio.file.FileVisitResult
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.nio.file.SimpleFileVisitor
import java.nio.file.attribute.BasicFileAttributes
import java.nio.file.attribute.PosixFilePermission

// What one agent keeps on its machine apart from the other agents there:
// its engine log (ImageDir.engineLog), its events file (KitFiles.events),
// its inbox folder (other agents' messages, InboxFolder) and, for an agent that keeps its own state (AgentRecord.ownState), its
// state folder `<home>/.phonecando/agents/<agentId>/` (the guest's
// /root/.phonecando/agents/<agentId>/): its sign-in, settings, chats and
// global instructions, where the kind's state env points it (kit
// LaunchContext.stateDir). Everything else on the machine is shared. An
// agent that kept its state where its kind does leaves it in the shared
// home (kit AgentKind.userStatePaths), which goes too when the machine
// stays, so the next agent of the kind there starts clean.
// deleteAgent removes these. Only a path under the image reached through
// real folders is deleted, and a link in it is removed as a link, never
// followed into what the agents share. Pure JVM.
internal object AgentFiles {
  const val STATE = ".phonecando/agents"

  fun stateDir(home: File, agentId: String) = File(home, "$STATE/$agentId")

  /** [agent]'s state folder; null when it keeps its state where its kind does. */
  fun ownState(home: File, agent: AgentRecord): File? = if (agent.ownState) stateDir(home, agent.id) else null

  /**
   * Makes [stateDir] and the folders [kind] keeps in it (its config dir,
   * its instructions file's folder): a program may need them before it
   * writes anything (Codex's CODEX_HOME).
   */
  fun makeState(kind: AgentKind, home: File, stateDir: File) {
    stateDir.mkdirs()
    kind.configDir(home, stateDir)?.mkdirs()
    kind.instructionsFile(home, stateDir)?.parentFile?.mkdirs()
  }

  /** The files [agent] leaves on its machine [image]. */
  fun of(image: ImageDir, agent: AgentRecord): List<File> = listOfNotNull(
    image.engineLog(agent.id),
    KitFiles.events(image.home, agent.id),
    InboxFolder.dir(image.home, agent.id),
    ownState(image.home, agent),
  )

  /**
   * The state [agent] leaves in the shared home: its [kind]'s user state
   * paths when it kept its state there and its machine stays
   * ([machineStays]: other agents are on it); else none.
   */
  fun userState(image: ImageDir, agent: AgentRecord, kind: AgentKind?, machineStays: Boolean): List<File> =
    if (agent.ownState || !machineStays || kind == null) emptyList() else kind.userStatePaths(image.home)

  /** Deletes [of] and [userState]; returns what is left of them, for the caller to log (it never fails on it). */
  fun remove(image: ImageDir, agent: AgentRecord, kind: AgentKind?, machineStays: Boolean): List<File> =
    (of(image, agent) + userState(image, agent, kind, machineStays)).filterNot { deleted(image.root, it) }

  // True when [file] is gone (or was never there). Refused unless it lies
  // under [root] through real folders: a link on the way would lead the
  // delete out of the agent's files.
  private fun deleted(root: File, file: File): Boolean {
    val base = root.absoluteFile.toPath().normalize()
    val path = file.absoluteFile.toPath().normalize()
    if (!path.startsWith(base) || path == base) return false
    var dir = path.parent
    while (dir != null && dir != base) {
      if (Files.isSymbolicLink(dir)) return false
      dir = dir.parent
    }
    deleteTree(path)
    return !Files.exists(path, LinkOption.NOFOLLOW_LINKS)
  }

  // Bottom up, without following links (walkFileTree's default), each
  // folder made owner-rwx first: a guest may leave read-only ones behind.
  private fun deleteTree(root: Path) {
    if (!Files.exists(root, LinkOption.NOFOLLOW_LINKS)) return
    try {
      Files.walkFileTree(
        root,
        object : SimpleFileVisitor<Path>() {
          override fun preVisitDirectory(dir: Path, attrs: BasicFileAttributes): FileVisitResult {
            try {
              Files.setPosixFilePermissions(dir, Files.getPosixFilePermissions(dir, LinkOption.NOFOLLOW_LINKS) + OWNER_RWX)
            } catch (_: Exception) {
              // The deletes below show whether it mattered.
            }
            return FileVisitResult.CONTINUE
          }

          override fun visitFile(file: Path, attrs: BasicFileAttributes): FileVisitResult {
            quietly { Files.deleteIfExists(file) }
            return FileVisitResult.CONTINUE
          }

          override fun visitFileFailed(file: Path, exc: IOException): FileVisitResult {
            quietly { Files.deleteIfExists(file) }
            return FileVisitResult.CONTINUE
          }

          override fun postVisitDirectory(dir: Path, exc: IOException?): FileVisitResult {
            quietly { Files.deleteIfExists(dir) }
            return FileVisitResult.CONTINUE
          }
        },
      )
    } catch (_: IOException) {
      // Left as it is.
    }
  }

  private inline fun quietly(block: () -> Unit) {
    try {
      block()
    } catch (_: IOException) {
    }
  }

  private val OWNER_RWX = setOf(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE, PosixFilePermission.OWNER_EXECUTE)
}
