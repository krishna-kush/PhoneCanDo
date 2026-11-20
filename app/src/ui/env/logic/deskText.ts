// What a machine's page says about desk codes (state/logic/desks.ts):
// how "room 2" and "desk 2a" are given. Pure (zero RN imports).

/**
 * Under a machine's agents: [room] ("room 2", null before it has one) is the machine's, [desk] ("desk 2a")
 * that of the agent its page was opened from (null when it was opened from its system).
 */
export function deskNote(room: string | null, desk: string | null): string {
  const how =
    "Each machine is a room with a number, and each agent in it sits at a desk with a letter: 1a and 1b share a machine, 2a has one of its own. A new machine or agent takes the first free number or letter, so a deleted agent's code can be given again.";
  if (!room) return how;
  return desk ? `This machine is ${room}, and this agent sits at ${desk}. ${how}` : `This machine is ${room}. ${how}`;
}
