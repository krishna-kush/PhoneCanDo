package com.phonecando.runner.bridge

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import com.phonecando.runner.AutomationHost
import com.phonecando.runner.notify.AgentNotices
import org.json.JSONObject

// The routes that read or post without touching the screen: /ping, /battery,
// /notify and /clipboard.
class DeviceRoutes(
  private val context: Context,
  private val channel: String,
  private val automation: () -> AutomationHost?,
) {
  private val notices = AgentNotices(context)

  fun table(): Map<Route, RouteHandler> = mapOf(
    Route.PING to { _ -> Reply.ok(ping()) },
    Route.BATTERY to { _ -> Reply.ok(battery()) },
    Route.NOTIFY to { call -> notify(call) },
    Route.CLIPBOARD to { call -> clipboard(call.body) },
  )

  private fun ping(): JSONObject = JSONObject()
    .put("channel", channel)
    .put("flavor", channel)
    .put("sdk", Build.VERSION.SDK_INT)
    .put("model", Build.MODEL)
    .put("automation", channel == "full")
    .put("unlocked", automation()?.enabled == true)
    // `ui` is kept as the compatibility alias used by the existing prompt.
    .put("ui", automation()?.connected == true)
    .put("pce", automation()?.connected == true)

  private fun battery(): JSONObject {
    val bm = context.getSystemService(BatteryManager::class.java)
    val sticky = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    val level = sticky?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale = (sticky?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100).coerceAtLeast(1)
    val status = sticky?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
    val percent = bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)?.takeIf { it in 0..100 }
      ?: ((level * 100) / scale)
    val charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
      status == BatteryManager.BATTERY_STATUS_FULL
    return JSONObject().put("percent", percent).put("charging", charging)
  }

  // The agent's own notification, labelled with its name: its title with
  // the name beside the app name, or the name as the title when it gave
  // none. One per agent and title (AgentNotices tags it with the agent), so
  // a new status with the same title replaces the last and agents never
  // replace each other's. A tap opens that agent's Home.
  private fun notify(call: BridgeCall): Reply {
    val o = call.body
    val text = o.optString("text", "").takeIf { it.isNotBlank() }
      ?: return Reply.badRequest("bad_request", "text is required")
    val title = o.optString("title", "").takeIf { it.isNotBlank() }
    val shown = notices.post(
      AgentNotices.Notice(
        agentId = call.agent.id,
        id = AgentNotices.notifyId(title.orEmpty()),
        title = title ?: call.agent.name,
        text = text,
        subText = call.agent.name.takeIf { title != null },
      ),
    )
    // Advisory, not an error: a missing POST_NOTIFICATIONS grant posts nothing.
    return Reply.ok(JSONObject().put("posted", shown))
  }

  private fun clipboard(o: JSONObject): Reply {
    val cm = context.getSystemService(ClipboardManager::class.java)
    return when (o.optString("action")) {
      "set" -> {
        val text = o.optString("text")
        cm.setPrimaryClip(ClipData.newPlainText("PhoneCanDo", text))
        Reply.ok(JSONObject().put("text", text))
      }
      "get" -> {
        val clip = runCatching { cm.primaryClip }.getOrNull()
        val text = if (clip != null && clip.itemCount > 0) {
          runCatching { clip.getItemAt(0).coerceToText(context)?.toString() }.getOrNull()
        } else {
          null
        }
        // API 29+ returns nothing to background apps; say so instead of "".
        Reply.ok(JSONObject().put("text", text ?: JSONObject.NULL).put("available", !text.isNullOrEmpty()))
      }
      else -> Reply.badRequest("bad_request", "action must be get or set")
    }
  }
}
