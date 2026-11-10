// PhoneCanDo's pi extension, loaded with `pi -e` (agent.json launch).
//
// - Events: tells the phone when a run starts, when pi waits on a prompt
//   and how the run settled, through the kit's phonecando-event script.
//   A run whose last reply ended in an error is AgentFailed; one you
//   aborted (Esc) raises nothing, and the runner ends it as stopped. It
//   prints nothing and never blocks pi.
// - Phone tools: registers our bridge as an HTTP MCP server for this
//   session, when the runner gave this engine the bridge. The URL comes
//   from the environment now; pi expands ${PHONECANDO_BRIDGE_TOKEN} in the
//   header itself, so the token is never written anywhere.
import { execFile } from "node:child_process";

const EVENT = "/root/.phonecando/bin/phonecando-event";

function raise(name: string): void {
  execFile("sh", [EVENT, name], () => {});
}

export default function (pi: any): void {
  let failed = false;
  pi.on("agent_start", () => {
    failed = false;
    raise("AgentStart");
  });
  pi.on("agent_end", (event: any) => {
    const messages = event?.messages ?? [];
    const last = messages[messages.length - 1];
    failed = last?.role === "assistant" && last?.stopReason === "error";
  });
  pi.on("ui_prompt_start", () => raise("PromptStart"));
  pi.on("agent_settled", (event: any) => {
    if (event?.aborted) return;
    raise(failed ? "AgentFailed" : "AgentSettled");
  });

  const bridge = process.env.PHONECANDO_BRIDGE_URL;
  if (bridge && process.env.PHONECANDO_BRIDGE_TOKEN) {
    pi.registerMcpServer("phonecando", {
      url: `${bridge}/mcp`,
      headers: { Authorization: "Bearer ${PHONECANDO_BRIDGE_TOKEN}" },
      description: "PhoneCanDo phone tools",
    });
  }
}
