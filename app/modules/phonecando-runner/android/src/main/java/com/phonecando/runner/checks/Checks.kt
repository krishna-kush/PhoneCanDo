package com.phonecando.runner.checks

import android.content.Context
import android.util.Log
import com.phonecando.agents.kit.Capability
import com.phonecando.agents.kit.EngineEvent
import com.phonecando.agents.kit.InboxCall
import com.phonecando.agents.kit.MessagingLevel
import com.phonecando.agents.kit.render.KindCapabilities
import com.phonecando.agents.kit.render.ManifestKind
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.checks.life.LifeWatcher
import com.phonecando.runner.checks.life.StateProbe
import com.phonecando.runner.checks.life.Watched
import com.phonecando.runner.checks.rules.CheckRules
import com.phonecando.runner.checks.rules.KindFacts
import com.phonecando.runner.checks.rules.LevelNow
import com.phonecando.runner.checks.rules.Verdict
import com.phonecando.runner.checks.store.CheckBook
import com.phonecando.runner.checks.store.CheckStore
import com.phonecando.runner.checks.store.CheckViews
import com.phonecando.runner.engine.LaunchPlan
import com.phonecando.runner.schedule.StateFile
import java.io.File
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap

// Whether each capability of an agent works, from signals the runner gets
// anyway (rules/CheckRules): the supervisor's launches, readiness, engine
// events, ACP openings and failures, exits and relaunches; the bridge's
// authenticated calls; the events file's `@hook` lines and `@inbox`
// receipts; the courier's server answers and wake-marked sets; the ACP
// relay's turn ends. Each signal returns at once: the life watcher
// (life/) decides on its own thread. A record per kind and capability is
// kept in files/state/checks.json (store/), each one told to [onChange]
// (with firstFailure for the one notification), and turn and engine ends
// to [onLife] (Check now, checks/now/). Signals before init() decide
// nothing; view() and levelNow() read what is kept (nothing before init).
object Checks {
  /** Each record kept, on the checks thread (checks/fanout/ sets it). */
  @Volatile var onChange: ((CheckChange) -> Unit)? = null

  /** Each turn end and engine end, on the checks thread (checks/fanout/ sets it). */
  @Volatile var onLife: ((agentId: String, LifeEvent) -> Unit)? = null

  private const val TAG = "PhoneCanDoChecks"

  private val book = CheckBook()

  private val rules = CheckRules(System::currentTimeMillis)

  @Volatile private var store: CheckStore? = null

  @Volatile private var watcher: LifeWatcher? = null

  // Per agent: bridge calls and hook reports in this process (Check now's movement).
  private val heardCounts = ConcurrentHashMap<String, Long>()

  /** Reads the records and starts the watcher; later calls do nothing. */
  fun init(context: Context) {
    if (watcher != null) return
    synchronized(this) {
      if (watcher != null) return
      val app = context.applicationContext ?: context
      val file = CheckStore(StateFile(File(app.filesDir, CheckStore.PATH)))
      book.load(file.load())
      store = file
      watcher = LifeWatcher(rules, ::keep) { agentId, event -> onLife?.invoke(agentId, event) }
    }
  }

  /** Every capability as [agent] reads it now, in enum order. */
  fun view(kind: ManifestKind, agent: AgentRecord): List<CapabilityView> =
    CheckViews.of(declared(kind, agent.ownState), { KindCapabilities.key(kind, it) }, book.of(kind.id))

  /** How many bridge calls and hook reports [agentId] made in this process: Check now sees it move. */
  fun heard(agentId: String): Long = heardCounts[agentId] ?: 0L

  /** How far messages reach an agent of [kind] now (LevelNow): its declared level, less what is failed. */
  fun levelNow(kind: ManifestKind): MessagingLevel =
    LevelNow.of(kind.messaging, CheckViews.ok(KindCapabilities.declared(kind), { KindCapabilities.key(kind, it) }, book.of(kind.id)))

  // ---- signals (the runner's; each returns at once) ----------------------------

  /** S4: [plan] launched, a new life (the slot adopted its process); [screen] reads its TUI's ring tail (null: none). */
  internal fun launched(agentId: String, plan: LaunchPlan, screen: () -> ByteArray?) {
    val w = watcher ?: return
    guarded {
      val kind = plan.kind
      val declared = declared(kind, plan.record.ownState)
      val life = rules.launch(agentId, KindFacts.of(kind, declared), plan.mode, plan.prompt, plan.chatId != null)
      val state = plan.stateDir?.let { StateProbe.of(it, life.launchedAt, kind.instructionsFile(plan.home, it)) }
      w.launched(
        Watched(
          life = life,
          kindId = kind.id,
          keys = declared.associateWith { KindCapabilities.key(kind, it) },
          cliVersion = plan.record.installedVersion.orEmpty(),
          state = state,
          screen = screen,
          secrets = listOf(plan.record.password, plan.record.bridgeToken),
        ),
      )
    }
  }

  /** S4: READY. */
  internal fun ready(agentId: String) {
    watcher?.ready(agentId)
  }

  /** S4: an engine event of its stream (a TUI's, a server's or ACP's). */
  internal fun engineEvent(agentId: String, event: EngineEvent) {
    // Only activity counts (no heartbeats, no catalog news).
    if (event.kind == EngineEvent.Kind.OTHER && !event.sessionCreated) return
    watcher?.event(agentId, event.kind, activity = true, guessed = event.guessed)
  }

  /** S4: ACP mode opened its chat. */
  internal fun acpOpened(agentId: String) {
    watcher?.acpOpened(agentId)
  }

  /** S4: an ACP turn ended, with its stop reason or error. */
  internal fun acpTurnEnded(agentId: String, stopReason: String?, error: String?) {
    watcher?.acpTurnEnded(agentId, stopReason, error)
  }

  /** S4: ACP mode could not open its chat. */
  internal fun acpFailed(agentId: String, reason: String) {
    watcher?.acpFailed(agentId, reason)
  }

  /** S4: it exited on its own, [died] or (a TUI's exit 0) not; [screen] its TUI's ring tail; [typed]: someone typed in it. */
  internal fun exited(agentId: String, code: Int, died: Boolean, reason: String?, screen: ByteArray?, typed: Boolean) {
    watcher?.exited(agentId, code, died, reason, screen, typed)
  }

  /** S4: ResumeFallback launches it again after an exit with [code]; launched() follows. */
  internal fun relaunched(agentId: String, code: Int) {
    watcher?.relaunched(agentId, code)
  }

  /** S4: stopped by us, or its start failed ([failed]: not a stop we asked for, with why). */
  internal fun ended(agentId: String, failed: Boolean, detail: String?) {
    watcher?.ended(agentId, failed, detail)
  }

  /** S1: an authenticated bridge request. */
  internal fun bridgeCall(agentId: String) {
    heardCounts.merge(agentId, 1L) { a, b -> a + b }
    watcher?.contact(agentId)
  }

  /** S2: an `@hook` line. */
  internal fun hookRan(agentId: String, event: String, wait: Boolean) {
    heardCounts.merge(agentId, 1L) { a, b -> a + b }
    watcher?.hook(agentId, event, wait)
  }

  /** S3: an `@inbox` receipt. */
  internal fun receipt(agentId: String, ids: List<Long>) {
    watcher?.receipt(agentId, ids)
  }

  /** S7: a server's answer to a deliver or wake call (2xx, 4xx or 5xx; nothing else counts). */
  internal fun served(agentId: String, call: InboxCall, status: Int) {
    if (status !in 200..599) return
    watcher?.served(agentId, call, status)
  }

  /** S3: a wake-marked set left in its inbox folder; [pending] reads the ids still pending there. */
  internal fun wakeSetWritten(agentId: String, ids: List<Long>, pending: () -> Set<Long>) {
    watcher?.wakeSet(agentId, ids, pending)
  }

  // ---- records -----------------------------------------------------------------

  // What [kind] declares for an agent: `state` only when it keeps its own.
  private fun declared(kind: ManifestKind, ownState: Boolean): Set<Capability> =
    KindCapabilities.declared(kind).let { if (ownState) it else it - Capability.STATE }

  // A verdict kept (on the checks thread): the record, the file, the listener.
  private fun keep(w: Watched, v: Verdict) {
    val key = w.keys[v.capability] ?: return
    val record = CheckRecord(
      state = if (v.failed) CheckState.FAILED else CheckState.CHECKED,
      key = key,
      cliVersion = w.cliVersion,
      at = System.currentTimeMillis(),
      agentId = w.life.agentId,
      code = v.code,
      detail = v.detail,
    )
    val put = book.put(w.kindId, v.capability, record)
    try {
      store?.save(book.all())
    } catch (e: IOException) {
      Log.w(TAG, "checks not saved", e)
    }
    onChange?.invoke(CheckChange(w.life.agentId, w.kindId, v.capability, put.record, put.firstFailure))
  }

  private inline fun guarded(block: () -> Unit) {
    try {
      block()
    } catch (e: Exception) {
      Log.w(TAG, "check signal not taken", e)
    }
  }
}
