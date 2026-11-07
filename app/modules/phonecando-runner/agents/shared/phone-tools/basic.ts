import { call } from "./client"
import { noArgs, type PhoneTool } from "./tool"

// The basic, non-automation tools. Every channel ships them; phone control
// lives in control/, which only full ships.
export const basicTools: PhoneTool[] = [
  {
    name: "mobile_ping",
    description:
      "Check the PhoneCanDo phone bridge. Returns {channel, sdk, model, automation, unlocked, ui, pce}: channel is full|lite|play, unlocked is the phone-control gate, ui is the accessibility/PCE availability (compatibility alias), and pce is the PCE backend. Ungated and safe to call first or after any failure; only full builds register the phone-control tools.",
    input: noArgs,
    channel: "all",
    run: (_args, signal) => call("/ping", undefined, signal),
  },
  {
    name: "mobile_battery",
    description: "Read the phone's battery. Ungated; returns {percent, charging} as reported by Android.",
    input: noArgs,
    channel: "all",
    run: (_args, signal) => call("/battery", undefined, signal),
  },
  {
    name: "mobile_notify",
    description:
      "Post an Android notification on the phone, labelled with your agent's name in PhoneCanDo; tapping it opens your chat. text is required; title defaults to your agent's name. A new notification with the same title replaces your previous one. Requires phone-control unlock in full builds and is ungated in lite/play. Use only when the user asked for a notification or status update.",
    input: {
      type: "object",
      properties: {
        title: { type: "string", description: "Notification title (default: your agent's name)" },
        text: { type: "string", description: "Notification body" },
      },
      required: ["text"],
      additionalProperties: false,
    },
    channel: "all",
    run: (args, signal) => call("/notify", { title: args.title, text: args.text }, signal),
  },
  {
    name: "mobile_share",
    description:
      "Open the Android share sheet with text. title is an optional subject. Requires phone-control unlock in full builds; the user picks the target app. Returns an error if no app can handle the share.",
    input: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to share" },
        title: { type: "string", description: "Optional subject/title" },
      },
      required: ["text"],
      additionalProperties: false,
    },
    channel: "all",
    run: (args, signal) => call("/share", { text: args.text, title: args.title }, signal),
  },
  {
    name: "mobile_open",
    description:
      "Open a URL with the phone's default app. This is NOT an app launcher: only http, https, mailto, tel, geo and market URLs are accepted, and app schemes such as whatsapp:// are rejected with bad_scheme. To launch an installed app use mobile_launch with its package name (full builds only). Requires phone-control unlock in full builds; works while PhoneCanDo is in the foreground.",
    input: {
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
    channel: "all",
    run: (args, signal) => call("/open", { url: args.url }, signal),
  },
  {
    name: "mobile_clipboard",
    description:
      "Read or write the phone clipboard. action=get|set; text is required for set. Reading needs PhoneCanDo in the foreground on Android 10+ because the OS hides clipboard contents from background apps. Requires phone-control unlock in full builds.",
    input: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["get", "set"] },
        text: { type: "string", description: "Text to copy when action=set" },
      },
      required: ["action"],
      additionalProperties: false,
    },
    channel: "all",
    run: (args, signal) => call("/clipboard", { action: args.action, text: args.text }, signal),
  },
]
