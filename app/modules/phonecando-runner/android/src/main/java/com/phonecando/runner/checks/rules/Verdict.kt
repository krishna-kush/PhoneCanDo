package com.phonecando.runner.checks.rules

import com.phonecando.agents.kit.Capability

/** What a rule decided for one capability: working, or not with [code] and [detail]. Pure. */
internal data class Verdict(val capability: Capability, val failed: Boolean, val code: String? = null, val detail: String? = null) {
  companion object {
    fun ok(capability: Capability) = Verdict(capability, failed = false)

    fun failed(capability: Capability, code: String, detail: String) = Verdict(capability, failed = true, code = code, detail = detail)
  }
}
