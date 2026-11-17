package com.phonecando.agents.kit.manifest

// The `engine.acp` block of an agent.json. Strict about the structure and
// types it reads, as ManifestDecoder is; kit-render's AcpChecks checks the
// rest (the engine style, placeholders, limits, the chat args); the full
// rules are the kit's TS validator's.
internal object AcpDecoder {
  fun acp(a: JsonFields) = AcpSpec(
    argv = ManifestDecoder.argv(a.at("argv"), a.array("argv")),
    env = a.stringMap("env"),
    tools = if (a.has("tools")) ManifestDecoder.enumOf(a, "tools", AcpTools.entries) { it.wire } else AcpTools.SESSION,
    options = a.stringMap("options"),
    optionsHook = a.optString("optionsHook"),
    meta = a.optObj("meta")?.tree,
    chat = a.optObj("chat")?.let { c -> ChatArgs(c.strings("args"), c.optInt("at")) },
  )
}
