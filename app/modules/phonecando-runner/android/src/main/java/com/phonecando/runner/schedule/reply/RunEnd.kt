package com.phonecando.runner.schedule.reply

import com.phonecando.agents.kit.EngineEvent
import com.phonecando.runner.engine.acp.AcpEvents

/**
 * How a scheduled run in a chat ended, for its reply and its notice: done,
 * failed, or stopped with no verdict (you stopped it, or its chat is gone),
 * which posts no notice, as no alert goes for it either. A stop the host
 * guessed (the server no longer runs the chat: a verdict that got lost)
 * counts as done. Pure.
 */
enum class RunEnd {
  DONE,
  FAILED,
  STOPPED,
  ;

  companion object {
    /** A server chat's event; null when it ends no run. */
    fun of(event: EngineEvent): RunEnd? = when (event.kind) {
      EngineEvent.Kind.FINISHED -> DONE
      EngineEvent.Kind.FAILED -> FAILED
      EngineEvent.Kind.STOPPED -> if (event.guessed) DONE else STOPPED
      EngineEvent.Kind.GONE -> STOPPED
      else -> null
    }

    /** An ACP turn's end, read as its events read it (AcpEvents). */
    fun ofAcp(stopReason: String?, error: String?): RunEnd = when (AcpEvents.kindOf(stopReason, error)) {
      EngineEvent.Kind.FAILED -> FAILED
      EngineEvent.Kind.STOPPED -> STOPPED
      else -> DONE
    }
  }
}
