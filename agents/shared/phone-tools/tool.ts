// One phone tool, independent of any agent kind: an agent's adapter
// registers these with its own plugin API (opencode: plugins/mobile/opencode.ts).
// The names, descriptions and schemas are a contract: prompts and saved chats
// rely on them, so keep them stable.
export type Args = Record<string, any>

// "all": every channel. "full": only full builds, whose config is the only
// one that ships the full-only tool files at all (control/).
export type Channel = "all" | "full"

export type PhoneTool = {
  name: string
  description: string
  /** JSON Schema of the arguments. */
  input: Record<string, unknown>
  channel: Channel
  run: (args: Args, signal?: AbortSignal) => Promise<string>
}

// The tools this engine's channel may offer. The service injects
// PHONECANDO_CHANNEL=full|lite|play; an engine started without it is full.
export function forChannel(tools: PhoneTool[], channel = process.env.PHONECANDO_CHANNEL ?? "full"): PhoneTool[] {
  return tools.filter((tool) => tool.channel === "all" || channel === "full")
}

export const noArgs = { type: "object", properties: {}, additionalProperties: false }
