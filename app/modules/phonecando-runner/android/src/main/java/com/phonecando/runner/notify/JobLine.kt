package com.phonecando.runner.notify

// One running job, or a model server reading a prompt, as its notification
// says it: [label], what it is about (a model, a system, an agent); [text],
// what it does now ("downloading 45%"); [share] in 0..1 for its bar, null
// when it only runs (nothing known yet, a re-read). Pure.
internal data class JobLine(val label: String, val text: String, val share: Double?) {
  /** "Qwen3.5 4B · downloading 45%". */
  val line: String get() = "$label · $text"

  /** Its own notification under the service's (ServicePlan): always with a bar. */
  fun item(key: String, target: LaunchTarget?, publicText: String): ServiceItem =
    ServiceItem(key, label, listOf(text), publicText, target, ServiceItem.Bar(share?.let { (it * 100).toInt().coerceIn(0, 100) }))
}
