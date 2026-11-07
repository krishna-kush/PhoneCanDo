package com.phonecando.runner.bridge

import android.content.Context
import android.content.Intent
import android.net.Uri
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.notify.LaunchTarget
import org.json.JSONObject

// The routes that start an activity: /share, /open and /app. Android blocks
// background activity starts, so /share and /open work while the app is
// foreground (the normal agent flow) and are silently dropped if the user
// backgrounded it mid-run; /app falls back to a notification.
class ActivityRoutes(private val context: Context, private val launcher: AppLauncher) {
  fun table(): Map<Route, RouteHandler> = mapOf(
    Route.SHARE to { call -> share(call.body) },
    Route.OPEN to { call -> open(call.body) },
    Route.APP to { call -> app(call.agent, call.body) },
  )

  private fun share(o: JSONObject): Reply {
    val text = o.optString("text", "").takeIf { it.isNotBlank() }
      ?: return Reply.badRequest("bad_request", "text is required")
    val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
    o.optString("title", "").takeIf { it.isNotBlank() }?.let { send.putExtra(Intent.EXTRA_SUBJECT, it) }
    val chooser = Intent.createChooser(send, "Share").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return try {
      context.startActivity(chooser)
      Reply.ok(JSONObject().put("started", true))
    } catch (e: Exception) {
      Reply.fail("no_activity", e.message ?: "no app to share to")
    }
  }

  private fun open(o: JSONObject): Reply {
    val raw = o.optString("url", "").takeIf { it.isNotBlank() }
      ?: return Reply.badRequest("bad_request", "url is required")
    val uri = try {
      Uri.parse(raw)
    } catch (_: Exception) {
      return Reply.badRequest("bad_url", "cannot parse url")
    }
    val scheme = uri.scheme?.lowercase()
      ?: return Reply.badRequest("bad_url", "url needs a scheme")
    if (scheme !in ALLOWED_SCHEMES) {
      return Reply.badRequest("bad_scheme", "allowed: ${ALLOWED_SCHEMES.joinToString(",")}")
    }
    val view = Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return try {
      context.startActivity(view)
      Reply.ok(JSONObject().put("started", true))
    } catch (e: Exception) {
      Reply.fail("no_activity", e.message ?: "nothing handles $scheme")
    }
  }

  // Own-app launch is intentionally outside the phone-control gate:
  // returning to PhoneCanDo is safe. The app opens on `tab` with the calling
  // agent active (the one that was driving the phone). In front, the event
  // switches at once; behind, the launch carries the target, and the return
  // notice (the agent's slot, so one per agent) is the fallback when Android
  // blocks a background activity start.
  private fun app(agent: AgentRecord, o: JSONObject): Reply {
    if (!launcher.canLaunch()) return Reply.fail("no_activity", "cannot resolve PhoneCanDo launch intent")
    val target = LaunchTarget.of(o.optString("tab", "home"), agent.id)
    val foreground = launcher.isForeground()
    // Foreground: the event switches; don't relaunch the task.
    val started = if (foreground) {
      launcher.show(target)
      true
    } else {
      launcher.launch(target)
    }
    val notified = o.optBoolean("notify", false) && !foreground && launcher.notifyReturn(agent, target.tab)
    return Reply.ok(JSONObject().put("started", started).put("notified", notified))
  }

  private companion object {
    val ALLOWED_SCHEMES = setOf("http", "https", "mailto", "tel", "geo", "market")
  }
}
