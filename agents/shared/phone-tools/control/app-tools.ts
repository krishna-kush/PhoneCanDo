import { call } from "../client"
import { noArgs, type PhoneTool } from "../tool"

// The full-only tools that are not drivers: back to PhoneCanDo, and the two
// prompts that ask the user (unlock, accessibility setup).
export const appTools: PhoneTool[] = [
  {
    name: "mobile_return",
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
    name: "mobile_request_unlock",
    description:
      "Phone control is locked (automation_off). Show the biometric/PIN prompt over the chat and wait up to 45s for the user. This never unlocks by itself. If the result has unlocked:true, continue the task; if unlocked:false, stop and ask the user to unlock. If another agent holds the screen (or it is kept for the next one in line), the call returns at once with your place in line and shows no prompt: that is not a refusal. You will get a message (agents_inbox) when the screen is yours, or see it in agents_list; call this again then, and do other work or end your turn meanwhile. Depending on the user's setting, an unlock may last only for this task (until you call mobile_return), so a later task may need to ask again. Never retry the locked action or try to bypass the gate.",
    input: noArgs,
    channel: "full",
    run: (_args, signal) => call("/unlock", { waitMs: 45_000 }, signal, 50_000),
  },
  {
    name: "mobile_open_accessibility",
    description:
      "UI automation is unavailable because Android's accessibility service is off (automation_unavailable). Shows PhoneCanDo's setup dialog over the chat and waits up to 4 minutes while the user follows it, returning as soon as the service connects. This never enables anything; only the user can flip the switch. Returns {opened, enabled, cancelled, restricted}. If enabled:true, continue the task right away. If cancelled:true, the user tapped 'Not now': stop and ask whether to continue. Otherwise (enabled:false after the wait), tell the user to finish the steps shown in PhoneCanDo and say when done; when they do, call mobile_ping and continue only when it reports ui:true. Do not call this again in a loop. restricted is 'sideload' when the user went through PhoneCanDo's restricted-settings guide (Android locks the switch for apps installed from a file: Android's 'Restricted setting' note, then App info → Allow restricted settings, then the switch). Never toggle accessibility yourself.",
    input: noArgs,
    channel: "full",
    // The bridge waits up to waitMs for the service; the client allows a
    // little more. Both stay under five minutes, where HTTP clients give up.
    run: (_args, signal) => call("/accessibility", { waitMs: 240_000 }, signal, 255_000),
  },
]
