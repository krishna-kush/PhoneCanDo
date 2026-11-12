// The agent's inbox folder ($PHONECANDO_INBOX), read as the kit's
// phonecando-inbox script reads it. While other agents' messages wait, the
// runner keeps pending/ there: `ids` (one per line), `messages.txt` (what
// the model reads), `messages.jsonl` (one object per message, each with its
// rendered `block`) and `wake` (present when they may wake an idle agent).
// claim() takes the whole set by renaming pending/ (atomic: of two readers
// one gets it), appends the receipt `@inbox TAB <ids>` to the agent's
// events file so the runner marks them read, and removes what it took.
import { appendFileSync, existsSync, readFileSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

export type Claimed = { ids: string[]; text: string; wake: boolean };

const PENDING = "pending";
const WAKE = "wake";

/** Whether messages wait in [inbox], and whether they may wake the agent. */
export function peek(inbox: string): { waiting: boolean; wake: boolean } {
  const pending = join(inbox, PENDING);
  return { waiting: existsSync(pending), wake: existsSync(join(pending, WAKE)) };
}

/** The waiting messages, now ours and receipted; null with none, or when another reader took them. */
export function claim(inbox: string, events: string | undefined): Claimed | null {
  const claimed = join(inbox, `claimed.${process.pid}`);
  rmSync(claimed, { recursive: true, force: true });
  try {
    renameSync(join(inbox, PENDING), claimed);
  } catch {
    return null;
  }
  try {
    const ids = read(claimed, "ids").split(/\s+/).filter((id) => /^\d+$/.test(id));
    const text = read(claimed, "messages.txt").trim() || blocks(read(claimed, "messages.jsonl"));
    const wake = existsSync(join(claimed, WAKE));
    if (ids.length > 0 && events) receipt(events, ids);
    return { ids, text, wake };
  } finally {
    rmSync(claimed, { recursive: true, force: true });
  }
}

// One line in one write to an O_APPEND file, as the kit's scripts do, so
// lines from hooks that write at once stay whole.
function receipt(events: string, ids: string[]): void {
  try {
    appendFileSync(events, `@inbox\t${ids.join(" ")}\n`);
  } catch {
    // The runner does not hear of it; the messages reach the chat all the same.
  }
}

function read(dir: string, name: string): string {
  try {
    return readFileSync(join(dir, name), "utf8");
  } catch {
    return "";
  }
}

// The rendered blocks of messages.jsonl, for a set without messages.txt.
function blocks(jsonl: string): string {
  const out: string[] = [];
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    try {
      const block = JSON.parse(line)?.block;
      if (typeof block === "string" && block) out.push(block);
    } catch {
      // A torn line: the others still go.
    }
  }
  return out.join("\n\n");
}
