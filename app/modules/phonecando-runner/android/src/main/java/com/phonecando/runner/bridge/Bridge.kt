package com.phonecando.runner.bridge

import android.content.Context
import android.os.SystemClock
import android.util.Log
import com.phonecando.runner.AutomationHost
import com.phonecando.runner.AutomationHosts
import com.phonecando.runner.agents.AgentDirectory
import com.phonecando.runner.bridge.mcp.McpToolAssets
import com.phonecando.runner.controllock.ControlLocks

/** A running loopback bridge: engines get [url] at launch, each with its own token. */
interface BridgeHandle {
  val url: String

  /** The agent's engine stopped: its ask-mode unlock ends with it. */
  fun agentGone(agentId: String)

  fun stop()
}

// The engine service's only entry to the bridge. It opens one bridge for all
// running agents (callers are told apart by their token, AgentDirectory) and
// stops it when the last engine stops. `onCall` gets the calling agent's id
// on every authenticated request (keeps that engine from being idle-stopped).
// The port it bound is kept for the next open (BridgePorts). The same
// routes are also MCP tools at /mcp, from the packaged tool table.
object Bridge {
  private const val TAG = "PhoneCanDoBridge"
  private const val PREFS = "phonecando_bridge"
  private const val KEY_PORT = "port"

  /** How long the screen stays with an idle agent (ScreenLease). */
  private const val LEASE_IDLE_MS = 30_000L

  // The open bridge's lease, for screenInUse; null while no bridge is open.
  @Volatile
  private var lease: ScreenLease? = null

  /** An agent is driving the screen now: a screen call runs or ran within the lease's idle time. */
  fun screenInUse(): Boolean = lease?.inUse() == true

  fun open(context: Context, agents: AgentDirectory, onCall: (agentId: String) -> Unit): BridgeHandle? {
    val app = context.applicationContext
    val channel = buildChannel(app)
    val automation: () -> AutomationHost? = {
      AutomationHosts.install()
      AutomationHosts.current
    }
    val launcher = AppLauncher(app)
    val lock = ControlLocks.get(app)
    val handlers = DeviceRoutes(app, channel, automation, lock).table() +
      ActivityRoutes(app, launcher).table() +
      PceRoutes(automation).table() +
      PromptRoutes(app, PromptFlows(BridgePrompts.registry, launcher), automation, lock).table()
    val screen = ScreenLease(LEASE_IDLE_MS) { SystemClock.elapsedRealtime() }
    val router = BridgeRouter(
      full = channel == "full",
      automation = automation,
      lock = lock,
      lease = screen,
      alive = { agents.get(it) != null },
      handlers = handlers,
      onError = { msg, e -> Log.w(TAG, msg, e) },
    )
    val prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val ports = BridgePorts.candidates(prefs.getInt(KEY_PORT, 0))
    val tools = McpToolAssets.load(app, full = channel == "full")
    val server = BridgeServer.start(ports, agents, router, tools, appVersion(app), onCall) ?: return null
    prefs.edit().putInt(KEY_PORT, server.listeningPort).apply()
    lease = screen
    return object : BridgeHandle {
      override val url = "http://127.0.0.1:${server.listeningPort}"

      override fun agentGone(agentId: String) = lock.endAsk(agentId)

      override fun stop() {
        server.stop()
        if (lease === screen) lease = null
        // No engine is left to hear the answers: end the waits now, and
        // every ask-mode unlock with them.
        BridgePrompts.registry.cancelAll()
        lock.endAsks()
      }
    }
  }

  // MCP's serverInfo.version.
  private fun appVersion(context: Context): String = try {
    context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "0"
  } catch (_: Exception) {
    "0"
  }

  private fun buildChannel(context: Context): String = try {
    val ai = context.packageManager.getApplicationInfo(
      context.packageName,
      android.content.pm.PackageManager.GET_META_DATA,
    )
    ai.metaData?.getString("com.phonecando.channel") ?: "full"
  } catch (_: Exception) {
    "full"
  }
}
