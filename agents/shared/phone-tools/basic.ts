import { call } from "./client"
import { noArgs, type PhoneTool } from "./tool"

// The basic, non-automation tools. Every channel ships them; phone control
// lives in control/, which only full ships.
export const basicTools: PhoneTool[] = [
  {
    name: "phone_ping",
    description:
      "Check the PhoneCanDo phone bridge. Returns {channel, sdk, model, automation, unlocked, ui, pce}: channel is full|lite|play, unlocked is the phone-control gate, ui is the accessibility/PCE availability (compatibility alias), and pce is the PCE backend. Ungated and safe to call first or after any failure; only full builds register the phone-control tools.",
    input: noArgs,
    channel: "all",
    run: (_args, signal) => call("/ping", undefined, signal),
  },
  {
    name: "phone_battery",
    description: "Read the phone's battery. Ungated; returns {percent, charging} as reported by Android.",
    input: noArgs,
    channel: "all",
    run: (_args, signal) => call("/battery", undefined, signal),
  },
  {
    name: "phone_notify",
    description:
      "Post an Android notification on the phone, labelled with your agent's name in PhoneCanDo; tapping it opens your chat. Use it to reach the user while they are away from your chat: progress on a long task, \"I'll need you in about 10 minutes\", something went wrong that they must act on. Never use it for what PhoneCanDo already tells them: a run finished, failed or waiting for their answer, a schedule, the phone hand-over. Check phone_focus first if unsure. text is required; title defaults to your agent's name; a new notification with the same title replaces your previous one. At most one a minute and five an hour (429 notify_too_often with retryAfterMs past that). While your chat is on screen it posts nothing and returns {posted:false, reason}: say it in the chat instead. Returns {posted, reason?}.",
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
    name: "phone_focus",
    description:
      "Where the user is looking now, before you reach them. Returns {app, onScreen, phone}: app is front or back (PhoneCanDo on screen or not); onScreen is your_chat, other_agent (another agent's chat), app (another PhoneCanDo page) or null while it is in the back; phone is unlocked, locked or off (screen off). In your chat, just say it there; away, phone_notify reaches them.",
    input: noArgs,
    channel: "all",
    run: (_args, signal) => call("/focus", {}, signal),
  },
  {
    name: "phone_share",
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
    name: "phone_open",
    description:
      "Open a URL with the phone's default app. This is NOT an app launcher: only http, https, mailto, tel, geo and market URLs are accepted, and app schemes such as whatsapp:// are rejected with bad_scheme. To launch an installed app use phone_launch with its package name (full builds only). Requires phone-control unlock in full builds; works while PhoneCanDo is in the foreground.",
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
    name: "phone_clipboard",
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
