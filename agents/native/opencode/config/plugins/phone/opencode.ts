import { Plugin } from "@opencode/plugin"
import { forChannel, type PhoneTool } from "../../phone-tools/tool"

// The opencode side of the phone tools: their table and bridge client live
// in phone-tools/ (agent-kind neutral, packaged next to plugins/ in the
// seeded config); this registers them with opencode v2's plugin API.
//
// shortcut: this engine build (2.0.26) has no ctx.permission.assert (newer v2
// does), and Code Mode bypasses top-level rules for plugin tools. The trust
// gate is the app-side master switch checked by the bridge; restore per-call
// asserts when the engine is bumped.
export function phonePlugin(id: string, tools: PhoneTool[]) {
  return Plugin.define({
    id,
    async setup(ctx) {
      const offered = forChannel(tools).map((tool) => ({
        name: tool.name,
        description: tool.description,
        input: tool.input,
        execute: async (args: Record<string, any>, context?: { signal?: AbortSignal }) => ({
          content: await tool.run(args ?? {}, context?.signal),
        }),
      }))
      await ctx.tool.transform((editor) => {
        for (const tool of offered) editor.add(tool)
      })
    },
  })
}
