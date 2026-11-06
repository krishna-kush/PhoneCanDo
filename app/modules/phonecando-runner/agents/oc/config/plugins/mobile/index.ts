import { Plugin } from "@opencode/plugin"
import { bridgeTool, call, type Args } from "./shared"

// Basic, non-automation tools. They stay in every channel; the PCE/phone-control
// plugin is full-only and is excluded from lite/play agent configs.
function makeTools() {
  return [
    bridgeTool(
      "mobile_ping",
      "Check the PhoneCanDo phone bridge. Returns {channel, sdk, model, automation, unlocked, ui, pce}: channel is full|lite|play, unlocked is the phone-control gate, ui is the accessibility/PCE availability (compatibility alias), and pce is the PCE backend. Ungated and safe to call first or after any failure; only full builds register the phone-control tools.",
      { type: "object", properties: {}, additionalProperties: false },
      (_args: Args, signal?: AbortSignal) => call("/ping", undefined, signal),
    ),
    bridgeTool(
      "mobile_battery",
      "Read the phone's battery. Ungated; returns {percent, charging} as reported by Android.",
      { type: "object", properties: {}, additionalProperties: false },
      (_args: Args, signal?: AbortSignal) => call("/battery", undefined, signal),
    ),
    bridgeTool(
      "mobile_notify",
      "Post an Android notification on the phone. text is required; title defaults to PhoneCanDo. Requires phone-control unlock in full builds and is ungated in lite/play. Use only when the user asked for a notification or status update.",
      {
        type: "object",
        properties: {
          title: { type: "string", description: "Notification title (default PhoneCanDo)" },
          text: { type: "string", description: "Notification body" },
        },
        required: ["text"],
        additionalProperties: false,
      },
      (args: Args, signal?: AbortSignal) => call("/notify", { title: args.title, text: args.text }, signal),
    ),
    bridgeTool(
      "mobile_share",
      "Open the Android share sheet with text. title is an optional subject. Requires phone-control unlock in full builds; the user picks the target app. Returns an error if no app can handle the share.",
      {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to share" },
          title: { type: "string", description: "Optional subject/title" },
        },
        required: ["text"],
        additionalProperties: false,
      },
      (args: Args, signal?: AbortSignal) => call("/share", { text: args.text, title: args.title }, signal),
    ),
    bridgeTool(
      "mobile_open",
      "Open a URL with the phone's default app. This is NOT an app launcher: only http, https, mailto, tel, geo and market URLs are accepted, and app schemes such as whatsapp:// are rejected with bad_scheme. To launch an installed app use mobile_launch with its package name (full builds only). Requires phone-control unlock in full builds; works while PhoneCanDo is in the foreground.",
      {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Absolute URL including scheme; scheme must be http, https, mailto, tel, geo or market",
          },
        },
        required: ["url"],
        additionalProperties: false,
      },
      (args: Args, signal?: AbortSignal) => call("/open", { url: args.url }, signal),
    ),
    bridgeTool(
      "mobile_clipboard",
      "Read or write the phone clipboard. action=get|set; text is required for set. Reading needs PhoneCanDo in the foreground on Android 10+ because the OS hides clipboard contents from background apps. Requires phone-control unlock in full builds.",
      {
        type: "object",
        properties: {
          action: { type: "string", enum: ["get", "set"] },
          text: { type: "string", description: "Text to copy when action=set" },
        },
        required: ["action"],
        additionalProperties: false,
      },
      (args: Args, signal?: AbortSignal) => call("/clipboard", { action: args.action, text: args.text }, signal),
    ),
  ]
}

export default Plugin.define({
  id: "phonecando.mobile",
  async setup(ctx) {
    const tools = makeTools()
    await ctx.tool.transform((editor) => {
      for (const tool of tools) editor.add(tool)
    })
  },
})
