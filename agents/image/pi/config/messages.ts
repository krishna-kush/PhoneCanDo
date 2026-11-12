// Other agents' messages into pi's chat (agent.json `inbox`: reader, and
// wake reader). The runner keeps them in $PHONECANDO_INBOX; inbox.ts claims
// them. While pi works they are steered into its run: after the current
// tool calls, before the next model request. While it is idle they wait
// for your next prompt and join its run (before_agent_start), unless the
// runner marked them as allowed to wake it: then they start a turn. pi
// shows them in the chat as their own entries; the model reads them as
// user text, each labelled as from another AI agent.
import { claim, peek, type Claimed } from "./inbox.ts";

const TYPE = "phonecando-agent-message";
// How often we look in the folder: one stat, no process.
const EVERY_MS = 1000;

export function agentMessages(pi: any): void {
  const inbox = process.env.PHONECANDO_INBOX;
  if (!inbox) return;
  const events = process.env.PHONECANDO_EVENTS;

  const entry = (c: Claimed) => ({ customType: TYPE, content: c.text, display: true, details: { ids: c.ids } });

  let timer: ReturnType<typeof setInterval> | undefined;
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = undefined;
  };

  // A session's ctx goes stale when pi replaces the session, so each
  // session_start looks with its own and session_shutdown stops it.
  pi.on("session_start", (_event: any, ctx: any) => {
    stop();
    timer = setInterval(() => {
      try {
        const now = peek(inbox);
        if (!now.waiting || (ctx.isIdle() && !now.wake)) return;
        const c = claim(inbox, events);
        if (!c?.text) return;
        // Steered while pi works; while idle, a wake starts a turn and
        // anything else only joins the chat (no turn).
        pi.sendMessage(entry(c), c.wake ? { deliverAs: "steer", triggerTurn: true } : { deliverAs: "steer" });
      } catch {
        // Never break pi over a message; the next look tries again.
      }
    }, EVERY_MS);
    timer.unref?.();
  });
  pi.on("session_shutdown", stop);

  pi.on("before_agent_start", () => {
    try {
      const c = claim(inbox, events);
      return c?.text ? { message: entry(c) } : undefined;
    } catch {
      return undefined;
    }
  });
}
