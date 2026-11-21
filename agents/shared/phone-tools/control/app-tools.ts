import { call } from "../client"
import { noArgs, type PhoneTool } from "../tool"

// How long a hand-over call may take: the bridge waits up to 4 minutes
// for the user (PresenceRoutes.WAIT_MAX_MS), and the client a little more.
const HANDS_WAIT_MS = 255_000

// The full-only tools that are not drivers: back to PhoneCanDo, the three
// prompts that ask the user (unlock, an app's first use, accessibility
// setup), and handing the user the phone's controls and waiting for them back.
export const appTools: PhoneTool[] = [
  {
    name: "phone_return",
    description:
      "Bring PhoneCanDo back to the foreground after finishing a phone-control task, with you as the active agent. tab=home|env|settings (default home, your chat). When PhoneCanDo is backgrounded it also posts a tap-to-return notification and reports notified:true; tell the user to tap it if the app did not come forward. Call this before your final report, not between steps: it hands the phone back, and if the user has phone control ask each time, it also ends your unlock. Ungated; registered in full builds.",
    input: {
      type: "object",
      properties: {
        tab: {
          type: "string",
          enum: ["home", "env", "settings"],
          description: "Tab to show after returning (default home)",
        },
      },
      additionalProperties: false,
    },
    channel: "full",
    run: (args, signal) =>
      call("/app", {
        tab: args.tab ?? "home",
        notify: true,
        reason: "return",
      }, signal),
  },
  {
    name: "phone_request_unlock",
    description:
      "Phone control is locked (automation_off). Show the biometric/PIN prompt over the chat and wait up to 45s for the user. This never unlocks by itself. If the result has unlocked:true, continue the task; if unlocked:false, stop and ask the user to unlock. If another agent holds the screen (or it is kept for the next one in line), the call returns at once with your place in line and shows no prompt: that is not a refusal. You will get a message (agents_inbox) when the screen is yours, or see it in agents_list; call this again then, and do other work or end your turn meanwhile. Depending on the user's setting, an unlock may last only for this task (until you call phone_return), so a later task may need to ask again. Never retry the locked action or try to bypass the gate.",
    input: noArgs,
    channel: "full",
    run: (_args, signal) => call("/unlock", { waitMs: 45_000 }, signal, 50_000),
  },
  {
    name: "phone_ask_app",
    description:
      "A screen call returned app_not_allowed: PhoneCanDo asks the user before agents use an app for the first time. Call this with the package that refusal names; it shows the user PhoneCanDo's question (Always / Just now / No) and waits up to 2 minutes. This never allows anything by itself. If allowed:true, observe the screen again (phone_observe), then go on with the task; answer \"once\" (Just now) lasts only until you call phone_return, so a later task may need to ask again. If answer is \"no\" or blocked:true, the user blocked agents from that app: don't use it; if the task needs it, call phone_hand_over and ask the user to do that part. If answer is null (no reply in time), tell the user PhoneCanDo is waiting for their answer, then do other work or end your turn; don't call this again in a loop. If notified:true, tell the user to tap the PhoneCanDo notification if the app did not come forward. Never try to reach the app another way (a link, a share, the shell, another app).",
    input: {
      type: "object",
      properties: {
        package: {
          type: "string",
          description: "The app's package name, as the app_not_allowed refusal gives it (e.g. com.example.app)",
        },
      },
      required: ["package"],
      additionalProperties: false,
    },
    channel: "full",
    // The bridge waits up to waitMs for the user; the client allows a little more.
    run: (args, signal) => call("/app-access", { package: args.package, waitMs: 120_000 }, signal, 135_000),
  },
  {
    name: "phone_open_accessibility",
    description:
      "UI automation is unavailable because Android's accessibility service is off (automation_unavailable). Shows PhoneCanDo's setup dialog over the chat and waits up to 4 minutes while the user follows it, returning as soon as the service connects. This never enables anything; only the user can flip the switch. Returns {opened, enabled, cancelled, restricted}. If enabled:true, continue the task right away. If cancelled:true, the user tapped 'Not now': stop and ask whether to continue. Otherwise (enabled:false after the wait), tell the user to finish the steps shown in PhoneCanDo and say when done; when they do, call phone_ping and continue only when it reports ui:true. Do not call this again in a loop. restricted is 'sideload' when the user went through PhoneCanDo's restricted-settings guide (Android locks the switch for apps installed from a file: Android's 'Restricted setting' note, then App info → Allow restricted settings, then the switch). Never toggle accessibility yourself.",
    input: noArgs,
    channel: "full",
    // The bridge waits up to waitMs for the service; the client allows a
    // little more. Both stay under five minutes, where HTTP clients give up.
    run: (_args, signal) => call("/accessibility", { waitMs: 240_000 }, signal, 255_000),
  },
  {
    name: "phone_hand_over",
    description:
      "Give the user the phone's controls when you need them on the screen. Watch (default): you need their input (pick a photo or a contact, choose an option, check something): they drive while you may follow along with phone_observe; the call waits for them (up to 4 minutes) and returns {mode:\"watch\", back} (back:true: they handed the phone back; observe first, it may have changed). If back is false, call phone_wait_for_user to keep waiting. private:true: something is theirs alone (passwords, payments, 2FA codes, permission screens): you can't see the screen, and the call returns at once {mode:\"private\", back:false, message}: end your turn now; PhoneCanDo messages you to go on when they hand the phone back. why is one short line the user sees (at most 120 characters). You must hold the screen or find it free; while the user has the controls every other screen call is refused (user_has_controls). Requires phone-control unlock.",
    input: {
      type: "object",
      properties: {
        why: { type: "string", description: "What you need the user for, one short line they see (at most 120 characters)" },
        private: {
          type: "boolean",
          description: "true for passwords, payments, 2FA and permission screens: you can't see the screen until they hand it back",
        },
      },
      required: ["why"],
      additionalProperties: false,
    },
    channel: "full",
    // A watch hand-over waits up to 4 minutes; the client allows a little more.
    run: (args, signal) => call("/hands/over", { why: args.why, private: args.private }, signal, HANDS_WAIT_MS),
  },
  {
    name: "phone_wait_for_user",
    description:
      "Wait while the user has the phone's controls and you watch: you handed them over (phone_hand_over), or they took them (Let me on your mascot, or touching the screen). Takes no arguments: it waits for them, up to 4 minutes a call. Returns {back:true} once they hand the phone back (or when nothing of yours is handed over): observe the screen first, then go on with your task in this same turn. {back:false, mode:\"watch\"}: still theirs; call it again. {back:false, mode:\"private\"}: they stopped you: end your turn now, don't call again; PhoneCanDo messages you to go on when they tap Start me again.",
    input: noArgs,
    channel: "full",
    // The bridge waits up to 4 minutes; the client allows a little more.
    run: (_args, signal) => call("/hands/wait", {}, signal, HANDS_WAIT_MS),
  },
]
