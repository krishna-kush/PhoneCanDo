// Agent names: the kind's label and the agent's desk code ("opencode 1a",
// "opencode 1b": state/logic/desks.ts), so a new name says where the agent
// sits and is never one a deleted agent had. Names route the agents'
// messages to each other, so no two agents share one. An A-series serial
// (A-01, the brand mark; A-07, the site's Little; A-09, the app's guide)
// is our own characters' name, never an agent's. Pure.

const key = (name: string) => name.trim().toLowerCase();

/** An A-series serial: A, a dash, two digits. */
const SERIAL = /^a-\d{2}$/;

/** Whether [name] is an A-series serial, case and edge spaces aside: our own characters', so no agent may take it. */
export const nameReserved = (name: string): boolean => SERIAL.test(key(name));

/** A new agent's name: its kind's label and its desk code; a number after it only if someone took that by hand. */
export function nextAgentName(label: string, taken: readonly string[], code: string): string {
  const used = new Set(taken.map(key));
  const coded = `${label} ${code}`;
  if (!used.has(key(coded))) return coded;
  for (let n = 2; ; n++) {
    const name = `${coded} ${n}`;
    if (!used.has(key(name))) return name;
  }
}

/** Whether [name] is already another agent's, case and edge spaces aside. */
export function nameTaken(name: string, others: readonly string[]): boolean {
  return others.some((o) => key(o) === key(name));
}
