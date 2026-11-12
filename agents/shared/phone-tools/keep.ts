import { call } from "./client"
import type { PhoneTool } from "./tool"

// The agent's own ask to stay up while idle in the background (the
// runner's KeepAsks): every channel ships it, and no phone-control lock
// gates it. It calls one bridge route with its arguments as they are, so
// MCP serves it too (tools.json).
export const keepTools: PhoneTool[] = [
  {
    name: "agents_keep_running",
    description:
      "Keep yourself running while you are idle and PhoneCanDo is in the background, when you must stay reachable: you asked another agent something (agents_send) and want its answer to start your next turn, or you wait for something off the phone (a CI run, a deploy). Otherwise an idle agent is stopped soon after the user leaves the app, and a message never starts a stopped agent. Not for programs you started: a dev server or any job you left running already keeps you up. on:true needs a reason, one short line the user sees in PhoneCanDo's notification next to a Stop button, and lasts minutes (default 30, at most 120); call it again before it ends to renew, and with on:false as soon as you no longer need it. It also ends when your engine stops. The user can still stop you, and PhoneCanDo may stop you when the phone runs short of memory. Returns {on, reason, minutes, until (ISO time, UTC), userKeepsRunning (the user already keeps you running, so you need not ask)}.",
    input: {
      type: "object",
      properties: {
        on: { type: "boolean", description: "true to stay up, false to end your ask" },
        reason: {
          type: "string",
          description: "What you stay up for, one short line the user sees (required with on: true)",
        },
        minutes: { type: "integer", minimum: 1, maximum: 120, description: "How long, default 30, at most 120" },
      },
      required: ["on"],
      additionalProperties: false,
    },
    channel: "all",
    run: (args, signal) => call("/keep", { on: args.on, reason: args.reason, minutes: args.minutes }, signal),
  },
]
