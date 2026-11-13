import { call } from "./client"
import type { PhoneTool } from "./tool"

// The agent's own schedules (the runner's schedule/): tasks it sets for
// itself to run later or again. Every channel ships them, and no
// phone-control lock gates them. Each calls one bridge route with its
// arguments as they are, so MCP serves them too (tools.json).
const LATER =
  "At its time PhoneCanDo gives you the task as a reminder you set yourself (starting you if you are stopped), not as a new instruction from the user."

export const scheduleTools: PhoneTool[] = [
  {
    name: "schedule_add",
    description: `Schedule a task for yourself, to run later or again: to check back on something that takes time ("in 30 minutes, check whether the CI run for this branch passed and fix it if not"), or a routine ("every morning at 09:00, summarise the new issues"). It schedules only you; to have another agent do something, use agents_send. Give text, the task as you want to read it then (say what, where and why: you will not remember this chat), and exactly one of: at (an ISO-8601 time; without an offset it is the phone's local time), in (minutes from now), every (minutes, at least 15) or daily ("HH:MM", the phone's local time, with days to keep it to some weekdays). chat is new (a fresh chat) or same (this one); by default same for at and in, new for every and daily. ${LATER} Use it only when a later run helps; it is no timer for now. Returns {id, nextAt (ISO with offset), nextAtText (the phone's local time), timing, chat, zone}; error limit when you have too many, not_allowed when the user switched scheduling off for you.`,
    input: {
      type: "object",
      properties: {
        text: { type: "string", description: "The task, as you want to read it when it runs (at most 4000 characters)" },
        at: { type: "string", description: "Once at this time: ISO-8601, e.g. 2026-11-14T09:00; no offset means the phone's local time" },
        in: { type: "integer", minimum: 1, maximum: 527040, description: "Once, this many minutes from now" },
        every: { type: "integer", minimum: 15, description: "Again and again, every this many minutes (at least 15)" },
        daily: { type: "string", description: "Every day at this time, HH:MM in the phone's local time" },
        days: {
          type: "array",
          items: { type: "string", enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] },
          description: "With daily: only on these days (default every day)",
        },
        chat: {
          type: "string",
          enum: ["new", "same"],
          description: "new: run it in a fresh chat; same: in this one (default same for at and in, new for every and daily)",
        },
      },
      required: ["text"],
      additionalProperties: false,
    },
    channel: "all",
    run: (args, signal) =>
      call(
        "/schedule/add",
        { text: args.text, at: args.at, in: args.in, every: args.every, daily: args.daily, days: args.days, chat: args.chat },
        signal,
      ),
  },
  {
    name: "schedule_list",
    description:
      "List your schedules: the tasks set to run for you later or again, by you or by the user. Returns {now (ISO with offset), zone (the phone's time zone), schedules:[{id, text, timing, nextAt (ISO, null when it will not run again), chat, on, by (you or the user)}]}. Check it before schedule_add, so you do not set the same task twice.",
    input: { type: "object", properties: {}, additionalProperties: false },
    channel: "all",
    run: (_args, signal) => call("/schedule/list", {}, signal),
  },
  {
    name: "schedule_cancel",
    description:
      "Cancel one of your schedules by its id (from schedule_add or schedule_list), when the task is done or no longer wanted. You can cancel only the ones you set; one the user set answers not_allowed: ask the user to change it in PhoneCanDo's Schedules. Returns {id, cancelled: true}.",
    input: {
      type: "object",
      properties: { id: { type: "string", description: "The schedule's id" } },
      required: ["id"],
      additionalProperties: false,
    },
    channel: "all",
    run: (args, signal) => call("/schedule/cancel", { id: args.id }, signal),
  },
]
