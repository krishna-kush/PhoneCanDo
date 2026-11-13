package com.phonecando.runner.schedule

import android.content.Context
import android.util.Log
import com.phonecando.runner.agents.AgentStores
import com.phonecando.runner.agents.KindCatalogs
import com.phonecando.runner.engine.EngineStatus
import com.phonecando.runner.engine.Engines
import java.io.File
import java.time.ZoneId
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicBoolean

// The process's one scheduler: the book over files/state/schedules.json,
// the runs log (files/state/schedule-runs.jsonl), the one alarm and the
// firing. Made on first use (the alarm, a boot broadcast, the app, the
// bridge), which arms the alarm for the soonest time the book needs; every
// change arms it again and tells the app (ScheduleEvents). Alarms, re-arms,
// Run now and engine changes run on one thread of its own, so a restart's
// stop (up to ~3 s) never holds a broadcast thread or the bridge; engine
// statuses are read on the thread that changed them (Firing.onStatus), a
// burst of engine changes is decided once.
class Schedules private constructor(context: Context) {
  private val app = context.applicationContext ?: context
  private val worker = Executors.newSingleThreadExecutor { r -> Thread(r, "phonecando-schedules").apply { isDaemon = true } }
  private val dirty = AtomicBoolean(false)
  private val alarms = ScheduleAlarms(app)

  val runs = ScheduleRuns(StateFile(File(app.filesDir, RUNS)), ::warn)

  val book = ScheduleBook(
    store = ScheduleStore(StateFile(File(app.filesDir, FILE))),
    clock = System::currentTimeMillis,
    zone = ZoneId::systemDefault,
    refusal = ::refusal,
    onChange = ::changed,
    onError = ::warn,
  )

  private val firing = Firing(app, book, runs, alarms)

  private val listener = object : Engines.Listener {
    override fun onStatus(status: EngineStatus) {
      firing.onStatus(status)
      engines()
    }

    override fun onChats() = engines()
  }

  init {
    Engines.addListener(listener)
    alarms.arm(book.nextAlarm())
  }

  /** The alarm went off (ScheduleAlarmReceiver); [done] ends its broadcast. */
  fun onAlarm(done: () -> Unit) = later(done) { firing.onAlarm() }

  /** Boot, update, clock or zone change, exact alarms granted: [timeMoved] works the next times out again. */
  fun rearm(timeMoved: Boolean, done: () -> Unit) = later(done) {
    if (timeMoved) book.rezone()
    alarms.arm(book.nextAlarm())
  }

  /** Run now (the app, in front): null when it fires, else why not (ScheduleBook.NOT_FOUND, AGENT_GONE). */
  fun runNow(id: String): String? {
    val s = book.get(id) ?: return ScheduleBook.NOT_FOUND
    if (AgentStores.get(app).get(s.agentId) == null) return ScheduleBook.AGENT_GONE
    later({}) { firing.runNow(id) }
    return null
  }

  /** Exact alarms are allowed ("Alarms & reminders"). */
  fun exactAlarms(): Boolean = alarms.exact()

  /** Whether an agent of [kindId] can run scheduled tasks. */
  fun kindRuns(kindId: String): Boolean = KindCatalogs.get(app).get(kindId)?.runsSchedules == true

  /** A deleted agent: its schedules and its "Can schedule itself" go. */
  fun forget(agentId: String) {
    firing.forget(agentId)
    book.forget(agentId)
    SelfScheduling.get(app).forget(agentId)
  }

  // Why [agentId] cannot have schedules; null when it can.
  private fun refusal(agentId: String): ScheduleBook.Result.Refused? {
    val agent = AgentStores.get(app).get(agentId)
      ?: return ScheduleBook.Result.Refused(ScheduleBook.AGENT_GONE, "no such agent")
    if (kindRuns(agent.kind)) return null
    val label = KindCatalogs.get(app).get(agent.kind)?.displayName ?: agent.kind
    return ScheduleBook.Result.Refused(
      ScheduleBook.UNSUPPORTED,
      "$label cannot run scheduled tasks: it neither starts with a prompt nor can be woken",
    )
  }

  private fun changed() {
    alarms.arm(book.nextAlarm())
    ScheduleEvents.changed()
  }

  private fun engines() {
    if (!dirty.compareAndSet(false, true)) return
    later({}) {
      dirty.set(false)
      firing.onEngines()
    }
  }

  private fun later(done: () -> Unit, block: () -> Unit) {
    try {
      worker.execute {
        try {
          block()
        } catch (e: Exception) {
          warn("schedule task failed", e)
        } finally {
          done()
        }
      }
    } catch (e: RejectedExecutionException) {
      warn("schedule task not run", e)
      done()
    }
  }

  private fun warn(message: String, e: Throwable) {
    Log.w(TAG, message, e)
  }

  companion object {
    private const val TAG = "PhoneCanDoSchedules"

    /** The schedules and their waiting firings, in app-private storage. */
    const val FILE = "state/schedules.json"

    /** The runs log. */
    const val RUNS = "state/schedule-runs.jsonl"

    @Volatile private var instance: Schedules? = null

    fun get(context: Context): Schedules = instance ?: synchronized(this) {
      instance ?: Schedules(context).also { instance = it }
    }

    /** The scheduler if anything made it yet. */
    fun peek(): Schedules? = instance
  }
}
