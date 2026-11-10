package com.phonecando.runner.engine

import com.phonecando.agents.kit.manifest.Manifest
import com.phonecando.agents.kit.manifest.PhoneTools

// Which engines get the bridge: only those whose kind names a way to reach
// the phone tools (`phoneTools`: plugin, mcp:config or mcp:argv). Such an
// engine gets the bridge URL and its agent's token in its env (EngineEnv),
// and the bridge answers that token while it runs (LiveAgents). A kind that
// says none, or nothing, gets neither: its engine and everything it starts
// never see the token, and the bridge would refuse it anyway. Pure.
internal object BridgeAccess {
  fun granted(manifest: Manifest): Boolean = manifest.phoneTools.let { it != null && it != PhoneTools.NONE }
}
