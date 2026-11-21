package com.phonecando.runner.bridge

import android.app.KeyguardManager
import android.content.Context
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import com.phonecando.runner.AutomationHost
import com.phonecando.runner.AutomationHosts
import com.phonecando.runner.agents.AgentDirectory
import com.phonecando.runner.appaccess.AppAccesses
import com.phonecando.runner.appaccess.PhoneApps
import com.phonecando.runner.autooff.AutoOff
import com.phonecando.runner.bridge.mcp.McpToolAssets
import com.phonecando.runner.controllock.ControlLocks
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.work.KeepAsks
import com.phonecando.runner.engine.work.KeepRunning
import com.phonecando.runner.messages.Messages
import com.phonecando.runner.notify.AppOnScreen
import com.phonecando.runner.presence.Focus
import com.phonecando.runner.presence.NotifyRules
import com.phonecando.runner.presence.Presence
import com.phonecando.runner.prompts.PermissionPrompts
import com.phonecando.runner.schedule.PhoneTime
import com.phonecando.runner.schedule.Schedules
import com.phonecando.runner.schedule.SelfScheduling
import com.phonecando.runner.screenshots.Screenshots

/** A running loopback bridge: engines get [url] at launch, each with its own token. */
interface BridgeHandle {
  val url: String

  /** The agent's engine stopped: its ask-mode unlock and its "Just now" apps end with it. */
  fun agentGone(agentId: String)

  fun stop()
}

// The engine service's only entry to the bridge. It opens one bridge for all
// running agents (callers are told apart by their token, AgentDirectory) and
// stops it when the last engine stops. `onCall` gets the calling agent's id
// on every authenticated request (keeps that engine from being idle-stopped).
// The port it bound is kept for the next open (BridgePorts). The same
// routes are also MCP tools at /mcp, from the packaged tool table, whose
// results end with the caller's unread agent messages. The agents' own
// messages (/agents/*, AgentRoutes) and the screen line's notices go
// through the process's Messages; a turn another agent's message started
// is told apart there (WakeTracker) for the screen line (BridgeRouter).
// The screen line moves on every second (ScreenTicker), and an agent whose
// engine is gone leaves it. An agent's ask to stay up (/keep, KeepRoutes)
// goes to the work watch's KeepAsks, which drops it with the engine. An
// agent's tasks for itself (/schedule/*, ScheduleRoutes) go to the
// process's Schedules, as long as its "Can schedule itself" is on. The
// agents' presence (presence/: the hand-over to you, status lines, where
// you look; PresenceRoutes) works on this bridge's lease while it is open,
// and hears each second, each granted screen request and each engine gone.
// Full builds check the app in front against the user's app-access list
// (appaccess/, the router's gate; /app-access, AppAccessRoutes), and keep
// agents' taps off PhoneCanDo's own questions while one waits
// (OwnQuestions: app and unlock prompts, agents' permission questions).
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

  /**
   * The agent in the middle of driving the phone: it holds the screen, idle
   * or not, in a run that has not ended or given it back (phone_return).
   * Null while the screen is free or no bridge is open.
   */
  fun screenHolder(): String? = lease?.holderId()

  /**
   * An agent wants the screen: one holds it (idle or not, as [screenHolder]),
   * it is kept for the first in line, or someone waits. Auto off (autooff/)
   * leaves Accessibility on meanwhile.
   */
  fun screenWanted(): Boolean {
    val screen = lease ?: return false
    if (screen.holderId() != null) return true
    val line = screen.line()
    return line.holder != null || line.waiting.isNotEmpty()
  }

  /**
   * The agent has no run going any more: its status goes, and it gives back
   * the screen if it holds it (ScreenLease.runEnded), unless you have the
   * controls it handed over (Presence keeps the screen for it).
   */
  fun runEnded(agentId: String) {
    if (!Presence.runEnded(agentId)) lease?.runEnded(agentId)
  }

  /** Who holds the screen and who waits for it; null while no bridge is open. */
  fun screenLine(): ScreenLease.Line? = lease?.line()

  fun open(context: Context, agents: AgentDirectory, onCall: (agentId: String) -> Unit): BridgeHandle? {
    val app = context.applicationContext
    val channel = buildChannel(app)
    val automation: () -> AutomationHost? = {
      AutomationHosts.install()
      AutomationHosts.current
    }
    val launcher = AppLauncher(app)
    val lock = ControlLocks.get(app)
    val full = channel == "full"
    val appAccess = if (full) AppAccesses.get(app) else null
    // Nothing left there from before is anyone's (screenshots/).
    Screenshots.clear(app.cacheDir)
    val flows = PromptFlows(BridgePrompts.registry, launcher)
    val messages = Messages.get(app)
    val notifyRules = NotifyRules { SystemClock.elapsedRealtime() }
    val chatOnScreen = { agentId: String -> NotifyRules.chatOnScreen(AppOnScreen.shown, Engines.peek()?.openAgent(), agentId) }
    val handlers = DeviceRoutes(app, channel, automation, lock, notifyRules, chatOnScreen).table() +
      ActivityRoutes(app, launcher).table() +
      PceRoutes(automation).table() +
      PromptRoutes(app, flows, automation, lock).table() +
      AppAccessRoutes(flows) { AppAccesses.get(app) }.table() +
      AgentRoutes(messages.mailbox, messages.view).table() +
      KeepRoutes(KeepAsks.shared, KeepRunning.get(app)::isOn) { Engines.work()?.poke() }.table() +
      ScheduleRoutes(Schedules.get(app).book, SelfScheduling.get(app)::isOn, timeText = PhoneTime.text(app)).table() +
      PresenceRoutes(Presence.store, { focusFacts(app) }).table()
    val screen = ScreenLease(LEASE_IDLE_MS, notices = messages.screenNotices(LEASE_IDLE_MS)) { SystemClock.elapsedRealtime() }
    val router = BridgeRouter(
      full = full,
      automation = automation,
      lock = lock,
      lease = screen,
      alive = { agents.get(it) != null },
      handlers = handlers,
      onError = { msg, e -> Log.w(TAG, msg, e) },
      startedByAgent = messages.mailbox.wakes::startedByAgent,
      onDrive = { agentId ->
        Presence.publish()
        Screenshots.screenTo(agentId)
      },
      handOver = Presence.store::handOver,
      onPaused = Presence.store::pausedCall,
      leftStopped = Presence.store::leftStopped,
      autoOff = { AutoOff.turnedOff(app) },
      appAccess = appAccess,
      ownPackage = app.packageName,
      questionWaiting = { BridgePrompts.userDeciding() || PermissionPrompts.registry.pending().isNotEmpty() },
      linkHandler = if (full) PhoneApps(app)::linkHandler else { _ -> null },
      onHandedBack = Screenshots::ended,
    )
    val prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val ports = BridgePorts.candidates(prefs.getInt(KEY_PORT, 0))
    val tools = McpToolAssets.load(app, full = full)
    val server = BridgeServer.start(ports, agents, router, tools, appVersion(app), onCall, messages.mailbox::unread)
      ?: return null
    prefs.edit().putInt(KEY_PORT, server.listeningPort).apply()
    lease = screen
    Presence.attach(app, screen) { agents.get(it) != null }
    val ticker = ScreenTicker(screen, alive = { agents.get(it) != null }) {
      Presence.tick()
      Screenshots.sweep()
    }.also { it.start() }
    return object : BridgeHandle {
      override val url = "http://127.0.0.1:${server.listeningPort}"

      override fun agentGone(agentId: String) {
        // Its hand-over ends (no note) and its status goes.
        Presence.forget(agentId)
        notifyRules.forget(agentId)
        lock.endAsk(agentId)
        appAccess?.endJustNow(agentId)
        Screenshots.ended(agentId)
        // Out of the screen line: it holds nothing and waits for nothing.
        screen.forget(agentId)
      }

      override fun stop() {
        ticker.stop()
        server.stop()
        if (lease === screen) lease = null
        // Nobody drives a phone with no bridge.
        Presence.detach(screen)
        // No engine is left to hear the answers: end the waits now, and
        // every ask-mode unlock and "Just now" app with them.
        BridgePrompts.registry.cancelAll()
        lock.endAsks()
        appAccess?.endAllJustNow()
        Screenshots.clear(app.cacheDir)
      }
    }
  }

  // Where the user looks, for /focus: the app and the chat it shows, the screen on, the keyguard up.
  private fun focusFacts(context: Context): Focus.Facts = Focus.Facts(
    appShown = AppOnScreen.shown,
    openAgent = Engines.peek()?.openAgent(),
    interactive = context.getSystemService(PowerManager::class.java)?.isInteractive != false,
    locked = context.getSystemService(KeyguardManager::class.java)?.isKeyguardLocked == true,
  )

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
