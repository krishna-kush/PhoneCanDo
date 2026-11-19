// What an agent's Machine page says about desk codes (state/logic/desks.ts):
// how "room 2" and "desk 2a" are given. Pure (zero RN imports).

/** Under the machine's card: [room] ("room 2", null before it has one) and [desk] ("desk 2a") are this agent's. */
export function deskNote(room: string | null, desk: string): string {
  const how =
    "Each machine is a room with a number, and each agent in it sits at a desk with a letter: 1a and 1b share a machine, 2a has one of its own. A new machine or agent takes the first free number or letter, so a deleted agent's code can be given again.";
  return room ? `This machine is ${room}, and this agent sits at ${desk}. ${how}` : how;
}
