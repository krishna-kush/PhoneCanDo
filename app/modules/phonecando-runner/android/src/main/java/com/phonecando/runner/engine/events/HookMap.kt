package com.phonecando.runner.engine.events

import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.manifest.PtyEvent
import com.phonecando.agents.kit.render.ManifestKind

// A kind's `events[].hook.map` (ManifestKind.hookEvents): the names its
// hooks write to the events file (phonecando-event), each to the engine
// event it raises. Pure.
internal object HookMap {
  fun of(kind: ManifestKind): Map<String, EngineEvent.Kind> = kind.hookEvents.mapValues { kindOf(it.value) }

  private fun kindOf(event: PtyEvent) = when (event) {
    PtyEvent.WORKING -> EngineEvent.Kind.WORKING
    PtyEvent.WAITING -> EngineEvent.Kind.WAITING
    PtyEvent.FINISHED -> EngineEvent.Kind.FINISHED
    PtyEvent.FAILED -> EngineEvent.Kind.FAILED
  }
}
