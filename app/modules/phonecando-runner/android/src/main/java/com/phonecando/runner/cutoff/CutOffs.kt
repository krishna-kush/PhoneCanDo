package com.phonecando.runner.cutoff

import android.content.Context
import android.os.SystemClock
import android.text.format.DateFormat
import android.util.Log
import com.phonecando.linux.jobs.JobTarget
import com.phonecando.runner.agents.AgentRecord
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.checks.now.CheckNow
import com.phonecando.runner.cutoff.BringRules.Plan
import com.phonecando.runner.cutoff.CutOffLook.Offer
import com.phonecando.runner.cutoff.CutOffLook.Why
import com.phonecando.runner.engine.EngineMode
import com.phonecando.runner.engine.EngineState
import com.phonecando.runner.engine.EngineStatus
import com.phonecando.runner.engine.Engines
import com.phonecando.runner.engine.starts.EngineStarts
import com.phonecando.runner.engine.starts.LiveStartRoom
import com.phonecando.runner.engine.starts.StartHolds
import com.phonecando.runner.engine.tui.EngineTerminal
import com.phonecando.runner.jobs.JobsAnchor
import com.phonecando.runner.notify.ChatBoard
import com.phonecando.runner.schedule.Schedules
import com.phonecando.runner.schedule.StateFile
import java.io.File
import java.util.Date
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

// The process's record of the runs agents have going, on disk
// (files/state/cut-off-runs.json), and what it does with runs no stop
// ended: a reboot, an update, Android closing PhoneCanDo or an engine dying
// on its own cut them off (CutOffRules, CutOffLook, BringRules).
// - It hears the engines (Engines.Listener): a ready engine's busy chats
//   are its runs in this life, which take its last sign of work every 10
//   minutes (refreshSeen; a chat that shows working with none behind it
//   goes stale and is never offered); a stop ends them, or keeps them, marked,
//   while a stop that keeps runs is under way (hold: a self-update's
//   stop-all, Android ending our service, which is offered at once); an
//   engine dying on its own keeps them and offers them at once, unless you
//   typed into its TUI just before (a quit); a start that is not a
//   bring-back settles the agent's offer. Engines that are not ready, and
//   agents a Check now owns, are left alone, so chats leaving the board as
//   an engine goes never read as runs ending, and a check's chat is no run.
// - Once per process (look: a boot, an update, the app, the service, a
//   tap) runs an earlier process saw going are offered: one notice per
//   agent (CutOffNotice). Nothing starts until you tap Continue.
// - Continue (bring) starts the agent at once, inside your tap's leave to
//   start the service: one start at a time (never while another engine or
//   bring-back is starting, a Check now runs on it or its machine installs
//   an agent), never with no room (StartRoom: memory, your cap; it never
//   stops anyone). A failed start of ours holds back others' starts
//   (engine/starts/StartHolds), but your tap is never held. It starts in the
//   mode it ran, with the note to go on (CutOffText.goOn) in the same chat:
//   ACP mode reopens that chat or fails (StartPrompt.sameChat), a TUI
//   resumes its last chat, a server kind gets the note posted into its chat
//   once ready (ServerNote). A scheduled run it began as gets "brought back
//   at" in its detail, and it stays failed; the agent counts as brought
//   back (BringRules: twice in 6 hours, then Open only).
// - Dismiss, or a swipe, drops the agent's runs. A self-update you cancel
//   offers the runs its stop kept at once, one notice per agent
//   (updateCancelled); the app starts the other agents it stopped again.
// Its work runs on one thread; a listener call reads what it needs where it
// is called (whether a hold is on) and passes it on.
class CutOffs private constructor(context: Context) {
  private val app = context.applicationContext ?: context
  private val store = CutOffStore(StateFile(File(app.filesDir, FILE)))
  private val notice = CutOffNotice(app)
  private val agents = AgentStores.get(app)
  private val worker = Executors.newSingleThreadScheduledExecutor { r -> Thread(r, "phonecando-cutoffs").apply { isDaemon = true } }
  private val looked = AtomicBoolean(false)
  private val life = ProcessFacts.LIFE
  private val boot: Int? by lazy { ProcessFacts.bootCount(app) }
  private var book = CutOffBook()

  /** A bring-back under way: how it goes on, the chats, why it was cut off, when it began (elapsed ms). */
  private class Bring(val plan: Plan, val chats: List<String>, val title: String?, val why: Why, val at: Long)

  private val bringing = ConcurrentHashMap<String, Bring>()

  // The worker's own: per agent, when its engine life began (epoch ms),
  // whether a run was seen in it yet, and its TUI's terminal (your last
  // input, read after an exit).
  private val lifeStarts = HashMap<String, Long>()
  private val runSeen = HashSet<String>()
  private val terminals = HashMap<String, EngineTerminal>()

  /** Stops until this elapsed ms keep their runs, marked. */
  @Volatile private var hold: Pair<Held, Long>? = null

  private val listener = object : Engines.Listener {
    override fun onStatus(status: EngineStatus) {
      val held = heldNow()
      val at = System.currentTimeMillis()
      // The terminal is gone from the slot by the time an exit is told.
      val terminal = if (status.state == EngineState.READY) Engines.peek()?.terminalOf(status.agentId) else null
      later({}) { statusChanged(status, held, at, terminal) }
    }

    override fun onChats() {
      val engines = Engines.peek() ?: return
      val ready = engines.statuses().filter { it.state == EngineState.READY }.map { it to engines.chatsOf(it.agentId) }
      later({}) { chatsChanged(ready) }
    }
  }

  init {
    later({}) { book = store.load() }
    Engines.addListener(listener)
    // Runs still going take their agent's last sign of work (CutOffRules.refresh).
    worker.scheduleWithFixedDelay(
      { later({}) { refreshSeen() } },
      CutOffRules.SEEN_EVERY_MS,
      CutOffRules.SEEN_EVERY_MS,
      TimeUnit.MILLISECONDS,
    )
  }

  /** Once per process: offers the runs an earlier process saw going; [done] ends a broadcast. */
  fun look(trigger: CutOffLook.Trigger, done: () -> Unit = {}) = later(done) {
    if (!looked.compareAndSet(false, true)) return@later
    val engines = Engines.peek()
    val now = System.currentTimeMillis()
    val result = CutOffLook.look(
      book.runs, life, now, boot, trigger, ProcessFacts.lastExit(app),
      exists = { agents.get(it) != null },
      live = { !bringing.containsKey(it) && engines?.status(it)?.state?.live == true },
    )
    // A bring-back under way keeps its runs, and its notice is down.
    val kept = result.runs + book.runs.filter { bringing.containsKey(it.agentId) && it !in result.runs }
    save(book.copy(runs = kept, brought = BringRules.prune(book.brought, now)))
    for (o in result.offers) if (!bringing.containsKey(o.agentId)) offer(o)
    if (result.offers.isNotEmpty()) Log.i(TAG, "cut off: ${result.offers.joinToString { "${it.agentId} (${it.why.wire})" }}")
  }

  /** Continue on [agentId]'s notice ([why] it rode in): starts it in the same chat, now or not at all. */
  fun bring(agentId: String, why: Why, done: () -> Unit) = later(done) {
    // A second tap while it is on its way (one that never came is let go).
    bringing[agentId]?.let { b ->
      if (SystemClock.elapsedRealtime() - b.at < BringRules.STARTING_MAX_MS) return@later
      bringing.remove(agentId)
    }
    val agent = agents.get(agentId)
    val runs = book.runs.filter { it.agentId == agentId }
    if (agent == null || runs.isEmpty()) {
      notice.cancel(agentId)
      return@later
    }
    val offer = Offer(agentId, runs, why)
    if (Engines.peek()?.status(agentId)?.state?.live == true) {
      // It was started again meanwhile: it goes on from there.
      settle(agentId)
      return@later
    }
    val elapsed = SystemClock.elapsedRealtime()
    val ours = bringing.any { (_, b) -> elapsed - b.at < BringRules.STARTING_MAX_MS }
    BringRules.waitFor(
      checking = CheckNow.owns(agentId),
      installing = JobsAnchor.linuxJobs().any { it.target.kind == JobTarget.Kind.IMAGE && it.target.id == agent.imageId },
      starting = ours || Engines.peek()?.anyStarting() == true,
    )?.let { post(offer, ask = it, canContinue = true); return@later }
    LiveStartRoom(app).refusal()?.let { post(offer, ask = CutOffText.noRoom(it), canContinue = true); return@later }
    val now = System.currentTimeMillis()
    val newest = runs.maxByOrNull { it.seenAt }!!
    val chats = runs.mapNotNull { it.chatId }.distinct()
    val spent = BringRules.spent(book.brought, agentId, now)
    val plan = if (spent) Plan.OPEN else BringRules.plan(newest.mode, kindOf(agent), runs.map { it.chatId })
    if (plan == Plan.OPEN) {
      post(offer, ask = if (spent) CutOffText.AGAIN else CutOffText.OPEN, canContinue = false)
      return@later
    }
    if (plan == Plan.START_ACP) {
      val chat = newest.chatId ?: chats.first()
      if (agent.acpChat != chat) agents.setAcpChat(agentId, chat)
    }
    bringing[agentId] = Bring(plan, chats, newest.title, why, elapsed)
    val prompt = CutOffText.goOn(why).takeIf { plan != Plan.START_THEN_POST }
    val mode = if (plan == Plan.START_ACP) EngineMode.ACP else EngineMode.TERMINAL
    val refused = EngineStarts(app).start(agentId, prompt, newChat = false, mode = mode, sameChat = true)
    if (refused != null) {
      bringing.remove(agentId)
      post(offer, ask = CutOffText.REFUSED, canContinue = false)
      return@later
    }
    save(book.copy(brought = BringRules.add(book.brought, agentId, now)))
    linkScheduled(runs, now)
    notice.cancel(agentId)
    Log.i(TAG, "bringing back $agentId (${plan.name.lowercase()})")
  }

  /** Dismiss (or a swipe) on [agentId]'s notice: its runs go. */
  fun dismiss(agentId: String, done: () -> Unit) = later(done) { settle(agentId) }

  /**
   * You cancelled the installer of a self-update: the runs its stop kept
   * are offered at once (its notice's Continue goes on in the same chat),
   * stale ones go. [done] gets the agents offered, which the app leaves
   * stopped for their Continue (a start of its own would settle them).
   */
  fun updateCancelled(done: (List<String>) -> Unit) {
    var offered = emptyList<String>()
    later({ done(offered) }) {
      hold = null
      val offers = CutOffLook.cancelled(book.runs, life)
      val kept = offers.flatMap { it.runs }.toSet()
      save(book.copy(runs = CutOffRules.unheld(book.runs, Held.UPDATE, life) + kept))
      offers.forEach(::offer)
      offered = offers.map { it.agentId }
    }
  }

  /**
   * The stops in the next HOLD_MS keep the runs they end, marked [why]: a
   * self-update's stop-all (offered by the new build) or Android ending our
   * service (offered at once).
   */
  fun hold(why: Held) {
    hold = why to SystemClock.elapsedRealtime() + HOLD_MS
  }

  // ---- the engines (the worker) ---------------------------------------------------------

  private fun statusChanged(status: EngineStatus, held: Held?, at: Long, terminal: EngineTerminal?) {
    val id = status.agentId
    val bring = bringing[id]
    // Its terminal is kept only while ready; an exit reads your last input from it.
    val gone = if (status.state == EngineState.READY) null else terminals.remove(id)
    when (status.state) {
      EngineState.STARTING -> {
        lifeStarts[id] = at
        runSeen -= id
        if (bring == null && book.runs.any { it.agentId == id }) settle(id)
      }
      EngineState.READY -> {
        terminal?.let { terminals[id] = it }
        if (bring != null) wentOn(id, bring)
      }
      // A stop under way: its runs end now (a kill before STOPPED must not
      // bring them back), unless it keeps them. A bring-back stopping is
      // settled by how it ends.
      EngineState.STOPPING -> if (bring == null) save(book.copy(runs = CutOffRules.stopped(book.runs, id, held)))
      EngineState.STOPPED -> {
        bringing.remove(id)
        save(book.copy(runs = CutOffRules.stopped(book.runs, id, held)))
        if (held == Held.SYSTEM) CutOffLook.offerNow(book.runs, id, life)?.let(::offer)
      }
      EngineState.DIED -> when {
        bring != null -> broughtFailed(id, bring, CutOffText.STOPPED, status.error)
        book.runs.none { it.agentId == id && it.life == life } -> {}
        // Ctrl+C or /exit mid-run: yours, as a Stop would be.
        CutOffRules.quitByYou(gone?.lastInputAt, at) -> settle(id)
        else -> {
          save(book.copy(runs = CutOffRules.died(book.runs, id, at)))
          CutOffLook.offerNow(book.runs, id, life)?.let(::offer)
        }
      }
      EngineState.FAILED -> if (bring != null) broughtFailed(id, bring, CutOffText.failed(status.error), status.error)
    }
  }

  private fun chatsChanged(ready: List<Pair<EngineStatus, List<ChatBoard.Chat>>>) {
    var runs = book.runs
    val now = System.currentTimeMillis()
    val engines = Engines.peek() ?: return
    for ((status, chats) in ready) {
      // A stop that came in between has already ended its runs; a Check
      // now's chat is its test, not a run.
      if (engines.status(status.agentId).state != EngineState.READY || CheckNow.owns(status.agentId)) continue
      val busy = chats.filter { it.state == ChatBoard.State.WORKING || it.state == ChatBoard.State.WAITING }
      if (busy.isEmpty() && runs.none { it.agentId == status.agentId }) continue
      val acpChat = if (status.mode == EngineMode.ACP) agents.get(status.agentId)?.acpChat else null
      val seen = CutOffRules.Seen(
        status.agentId,
        status.mode,
        busy.map { CutOffRules.Busy(CutOffRules.chatId(status.mode, it.sessionId, acpChat), it.title, it.state == ChatBoard.State.WAITING) },
      )
      runs = CutOffRules.sync(runs, seen, life, boot, now, ::scheduleRunOf)
    }
    save(book.copy(runs = runs))
  }

  // Each ready agent with runs going in this life: its last sign of work, looked at now.
  private fun refreshSeen() {
    val engines = Engines.peek() ?: return
    val now = System.currentTimeMillis()
    var runs = book.runs
    val going = runs.filter { it.life == life && it.diedAt == null && it.held == null }.map { it.agentId }.distinct()
    for (id in going) {
      if (engines.status(id).state != EngineState.READY) continue
      runs = CutOffRules.refresh(runs, id, life, engines.lastSignAt(id), now)
    }
    save(book.copy(runs = runs))
  }

  // A bring-back is ready: a server kind gets its note now; its runs cut
  // off are over either way (the run going on is recorded as it moves).
  private fun wentOn(agentId: String, bring: Bring) {
    bringing.remove(agentId)
    StartHolds.shared.forget(agentId)
    val took = bring.plan != Plan.START_THEN_POST || ServerNote.post(app, agentId, bring.chats, CutOffText.goOn(bring.why))
    val runs = book.runs.filter { it.agentId == agentId }
    save(book.copy(runs = CutOffRules.wentOn(book.runs, agentId, life)))
    if (!took) post(Offer(agentId, runs, bring.why), ask = CutOffText.NOT_TAKEN, canContinue = false, title = bring.title)
  }

  // A bring-back that ended before it was ready: its runs stay, the notice
  // says why, and other starts of ours hold back as after any failed start.
  private fun broughtFailed(agentId: String, bring: Bring, ask: String, error: String?) {
    bringing.remove(agentId)
    StartHolds.shared.failed(agentId, error?.takeIf { it.isNotBlank() } ?: "it stopped while starting")
    post(Offer(agentId, book.runs.filter { it.agentId == agentId }, bring.why), ask = ask, canContinue = false, title = bring.title)
  }

  // ---- notices --------------------------------------------------------------------------

  // The notice for [offer]: Continue where it can go on by itself, else Open.
  private fun offer(offer: Offer) {
    val agent = agents.get(offer.agentId) ?: return
    val now = System.currentTimeMillis()
    val spent = BringRules.spent(book.brought, agent.id, now)
    val plan = if (spent) Plan.OPEN else BringRules.plan(newestMode(offer), kindOf(agent), offer.runs.map { it.chatId })
    val ask = when {
      plan != Plan.OPEN -> CutOffText.CONTINUE
      spent -> CutOffText.AGAIN
      else -> CutOffText.OPEN
    }
    post(offer, ask, canContinue = plan != Plan.OPEN)
  }

  private fun post(offer: Offer, ask: String, canContinue: Boolean, title: String? = null) {
    val agent = agents.get(offer.agentId) ?: return
    val chatTitle = title ?: offer.runs.maxByOrNull { it.seenAt }?.title
    notice.post(agent.id, agent.name, offer.why, chatTitle, canContinue, ask)
  }

  private fun settle(agentId: String) {
    save(book.copy(runs = CutOffRules.settled(book.runs, agentId)))
    notice.cancel(agentId)
  }

  // ---- helpers --------------------------------------------------------------------------

  private fun newestMode(offer: Offer): EngineMode = offer.runs.maxByOrNull { it.seenAt }?.mode ?: EngineMode.TERMINAL

  private fun kindOf(agent: AgentRecord): BringRules.Kind? = BringKinds.of(app, agent)

  // Each scheduled run these runs began as stays failed, with when it was brought back.
  private fun linkScheduled(runs: List<CutOffRun>, now: Long) {
    val seqs = runs.mapNotNull { it.scheduleRun }.distinct()
    if (seqs.isEmpty()) return
    val note = CutOffText.broughtNote(DateFormat.getTimeFormat(app).format(Date(now)))
    val schedules = Schedules.get(app)
    seqs.forEach { schedules.broughtBack(it, note) }
  }

  // The scheduled run a new run of [agentId] belongs to (CutOffRules.scheduleRun).
  private fun scheduleRunOf(agentId: String): Long? {
    val first = runSeen.add(agentId)
    val runs = Schedules.peek()?.runs ?: return null
    return CutOffRules.scheduleRun(runs.openOf(agentId), first, lifeStarts[agentId]) { runs.setWorkingSince(agentId, it) }
  }

  private fun heldNow(): Held? = hold?.takeIf { SystemClock.elapsedRealtime() < it.second }?.first

  private fun save(next: CutOffBook) {
    if (next == book) return
    book = next
    try {
      store.save(next)
    } catch (e: Exception) {
      Log.w(TAG, "cut-off runs not saved", e)
    }
  }

  private fun later(done: () -> Unit, block: () -> Unit) {
    try {
      worker.execute {
        try {
          block()
        } catch (e: Exception) {
          Log.w(TAG, "cut-off task failed", e)
        } finally {
          done()
        }
      }
    } catch (e: RejectedExecutionException) {
      Log.w(TAG, "cut-off task not run", e)
      done()
    }
  }

  companion object {
    private const val TAG = "PhoneCanDoCutOff"

    /** The record, in app-private storage. */
    const val FILE = "state/cut-off-runs.json"

    /** How long a hold covers the stops that follow it (a stop-all ends within ~3 s). */
    const val HOLD_MS = 15_000L

    @Volatile private var instance: CutOffs? = null

    fun get(context: Context): CutOffs = instance ?: synchronized(this) {
      instance ?: CutOffs(context).also { instance = it }
    }

    /** The record if anything made it yet. */
    fun peek(): CutOffs? = instance
  }
}
