package com.phonecando.runner.api

import android.content.Context
import com.phonecando.runner.schedule.ChatMode
import com.phonecando.runner.schedule.Checked
import com.phonecando.runner.schedule.ScheduleAlarms
import com.phonecando.runner.schedule.ScheduleBook
import com.phonecando.runner.schedule.ScheduleJs
import com.phonecando.runner.schedule.ScheduleJson
import com.phonecando.runner.schedule.ScheduleRules
import com.phonecando.runner.schedule.Schedules
import com.phonecando.runner.schedule.SelfScheduling
import com.phonecando.runner.schedule.SetBy
import com.phonecando.runner.schedule.Timing
import expo.modules.kotlin.modules.ModuleDefinitionBuilder
import org.json.JSONObject

// Schedules for JS (schedule/; the TS types are NativeSchedule and
// NativeScheduleRun, the wire JSON): the list, adding, changing and removing
// one (what you set is yours: by "user"), Run now, the runs log newest
// first, whether alarms are exact and Android's page to allow them, each
// agent's "Can schedule itself", and whether a kind can run tasks at all.
// Kept and run natively (Schedules), so tasks run with no JS around. Every
// change to schedules or runs is the phonecandoSchedules event
// (ScheduleEvents.listener, which the module wires).
internal fun ModuleDefinitionBuilder.scheduleFunctions(context: () -> Context) {
  // NativeSchedule[], in the order they were set.
  Function("listSchedules") {
    Schedules.get(context()).book.all().map(ScheduleJs::of)
  }

  // {agentId, text, timing, chat?} → {ok: true, schedule} | {ok: false, reason, code}
  // (ScheduleJs: reason is limit, unsupported, not_found or agent_gone, else a sentence).
  // An every with no anchor starts its grid now.
  Function("addSchedule") { spec: Map<String, Any?> ->
    val book = Schedules.get(context()).book
    val o = JSONObject(spec)
    val agentId = o.optString("agentId").takeIf { it.isNotEmpty() }
      ?: return@Function ScheduleJs.refused(ScheduleBook.AGENT_GONE, "no agent given")
    val timing = when (val t = timing(o) ?: return@Function ScheduleJs.refused(ScheduleBook.BAD, "no timing given")) {
      is Checked.Ok -> t.value
      is Checked.Bad -> return@Function ScheduleJs.refused(ScheduleBook.BAD, t.why)
    }
    val chat = chat(o)
    ScheduleJs.result(book.add(agentId, ScheduleBook.Draft(o.optString("text"), timing, chat), SetBy.USER))
  }

  // (id, {text?, timing?, chat?, on?}) → the same result as addSchedule.
  Function("updateSchedule") { id: String, patch: Map<String, Any?> ->
    val book = Schedules.get(context()).book
    val o = JSONObject(patch)
    val timing = when (val t = timing(o)) {
      null -> null
      is Checked.Ok -> t.value
      is Checked.Bad -> return@Function ScheduleJs.refused(ScheduleBook.BAD, t.why)
    }
    val text = if (o.has("text") && !o.isNull("text")) o.optString("text") else null
    val on = if (o.has("on") && !o.isNull("on")) o.optBoolean("on") else null
    ScheduleJs.result(book.update(id, ScheduleBook.Patch(text, timing, chat(o), on)))
  }

  Function("removeSchedule") { id: String ->
    Schedules.get(context()).book.remove(id)
  }

  // Fires it now (the app is in front, so it may start the agent); its
  // nextAt stays. {ok: true} | {ok: false, reason: "not_found" | "agent_gone"};
  // what came of it is in the runs.
  Function("runScheduleNow") { id: String ->
    val why = Schedules.get(context()).runNow(id)
    if (why == null) mapOf("ok" to true) else ScheduleJs.refused(why, why)
  }

  // NativeScheduleRun[], newest first; at most the log's cap.
  Function("scheduleRuns") { limit: Int ->
    Schedules.get(context()).runs.newest(limit.coerceIn(0, ScheduleRules.RUNS_KEPT)).map(ScheduleJs::of)
  }

  // {exact}: "Alarms & reminders" is allowed, so tasks run on time.
  Function("scheduleAlarms") {
    mapOf("exact" to Schedules.get(context()).exactAlarms())
  }

  // Opens Android's "Alarms & reminders" page for PhoneCanDo; false where there is none.
  Function("openAlarmSettings") {
    ScheduleAlarms.openSettings(context())
  }

  Function("canScheduleItself") { agentId: String ->
    SelfScheduling.get(context()).isOn(agentId)
  }

  // Returns the switch as kept.
  Function("setCanScheduleItself") { agentId: String, on: Boolean ->
    val prefs = SelfScheduling.get(context())
    prefs.set(agentId, on)
    prefs.isOn(agentId)
  }

  // An agent of the kind can run tasks: it starts with a prompt, or can be woken.
  Function("kindRunsSchedules") { kindId: String ->
    Schedules.get(context()).kindRuns(kindId)
  }
}

// The timing in [o], an every's missing anchor now; null when none is given.
private fun timing(o: JSONObject): Checked<Timing>? {
  val t = o.optJSONObject("timing") ?: return null
  return ScheduleJson.timing(t, anchor = System.currentTimeMillis())
}

private fun chat(o: JSONObject): ChatMode? = if (o.isNull("chat")) null else ChatMode.of(o.optString("chat"))
