package com.phonecando.runner.models.measure

import com.phonecando.lme.api.serve.MeasuredMemory

// Which measurement of a model's server we trust, and when a start
// measures again: one taken on this phone with this server build (its
// tag), at the context and KV cache the start plans; else the start runs
// the dry run first (about half a second on our test phone). Pure.
internal object MeasurePolicy {
  /** [stored] when it was taken on [phone]; null otherwise. */
  fun usable(stored: MeasuredMemory?, phone: String): MeasuredMemory? = stored?.takeIf { it.phone == phone }

  /** Whether [known] already counts a start at [context] tokens with an 8-bit KV cache or not ([halfKvCache]). */
  fun fresh(known: MeasuredMemory?, context: Long, halfKvCache: Boolean): Boolean =
    known != null && known.context == context && known.halfKvCache == halfKvCache
}
