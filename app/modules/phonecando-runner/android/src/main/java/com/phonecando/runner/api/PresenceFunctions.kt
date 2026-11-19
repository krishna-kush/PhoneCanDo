package com.phonecando.runner.api

import android.content.Context
import com.phonecando.runner.presence.GlassScheme
import com.phonecando.runner.presence.MascotFigures
import com.phonecando.runner.presence.Presence
import com.phonecando.runner.presence.PresenceEvents
import com.phonecando.runner.presence.PresenceJs
import expo.modules.kotlin.modules.ModuleDefinitionBuilder

// The agents' presence for JS (presence/; the map is PresenceJs's, which
// app/src/engine/presence/types.ts mirrors): the frame now, your buttons
// (Let me, Stop, Your turn, Start me again, Leave: a UserAct name), and
// each agent's mascot as figures for the overlay to draw, and the app's
// light or dark for it (GlassScheme). Every change is
// the phonecandoPresence event, the frame's map, through [emit]
// (PresenceEvents).
internal fun ModuleDefinitionBuilder.presenceFunctions(context: () -> Context, emit: (Map<String, Any?>) -> Unit) {
  PresenceEvents.sink = emit

  Function("presenceSnapshot") {
    PresenceJs.of(Presence.frame())
  }

  // False for an unknown act, or one that does not apply now. On the JS
  // thread, never the main one.
  Function("presenceAct") { act: String ->
    PresenceJs.act(act)?.let(Presence::user) ?: false
  }

  // Memory only: JS pushes them again at start and on every change of look.
  Function("setMascotFigures") { agentId: String, json: String ->
    MascotFigures.set(agentId, json)
  }

  // The app's theme setting ("system", "light" or "dark"); kept for drives with no app screen up.
  Function("setGlassScheme") { scheme: String ->
    GlassScheme.set(context(), scheme)
  }
}
