package com.phonecando.runner.models.chats

import com.phonecando.lme.api.model.ModelRecord
import com.phonecando.lme.host.LaunchPlan
import java.io.File
import java.io.IOException

// A model server's chats kept on storage, in the order a start needs
// them: its chats dir readied for the shape it starts with (before the
// server, which wants the dir there; a dir that cannot be made means its
// chats stay in RAM), then, once it answers, its go-between.
internal object ChatsOnStorage {
  /** [dir] ready for [plan]'s chats of [model] from a server binary of [serverBytes]; null when it cannot be. */
  fun files(dir: File, model: ModelRecord, plan: LaunchPlan, serverBytes: Long): ChatFiles? {
    val shape = ChatShape.of(model.id, model.entry.name, model.sizeBytes, plan.contextSize, plan.halfKvCache, plan.checkpoints, serverBytes)
    return try {
      ChatFiles(dir, plan.promptBytes).also { it.prepare(shape) }
    } catch (_: IOException) {
      null
    } catch (_: SecurityException) {
      null
    }
  }

  /**
   * The go-between for [plan]'s server, listening on [port]: agents get
   * its URL, with the server's key. @throws IOException when it cannot
   * listen.
   */
  fun relay(files: ChatFiles, plan: LaunchPlan, port: Int, onFailing: () -> Unit, log: (String) -> Unit): ChatRelay {
    val endpoint = plan.endpoint
    val slots = SlotCalls(endpoint.baseUrl, endpoint.key)
    val switch = ChatSwitch(files, slots::save, slots::restore, onFailing, log)
    val upstream = endpoint.baseUrl.substringAfterLast(':').toInt()
    return ChatRelay(upstream, endpoint.key, switch).start(port)
  }
}
