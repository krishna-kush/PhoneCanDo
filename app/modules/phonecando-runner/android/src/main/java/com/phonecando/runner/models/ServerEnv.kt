package com.phonecando.runner.models

import com.phonecando.runner.engine.EngineEnv

// A model server's process env: ours, less the bridge's (no agent's
// token), plus its plan's (its key), and the tags that make it ours to reap
// and tell apart (PHONECANDO_AGENT=model-server, PHONECANDO_MODEL=<id>).
// The same for a server and for the dry run that measures it first.
internal object ServerEnv {
  fun of(planEnv: Map<String, String>, modelId: String, base: Map<String, String> = System.getenv()): Map<String, String> {
    val env = LinkedHashMap(base)
    env.remove(EngineEnv.BRIDGE_URL)
    env.remove(EngineEnv.BRIDGE_TOKEN)
    env.putAll(planEnv)
    env[EngineEnv.AGENT] = ModelServer.TAG
    env[EngineEnv.MODEL] = modelId
    return env
  }
}
