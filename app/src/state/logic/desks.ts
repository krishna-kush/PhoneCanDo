// Desk codes: the user's coding agents by where they sit, as the site's
// floor plan draws a crew. The phone is the floor; each machine (image) is
// a room, numbered as it takes its first agent (1, 2, 3…); each agent has a
// desk in its machine's room, lettered in order (a, b, c…). So 1a and 1b
// share a machine, and 2a has one of its own. A number or letter is never
// given out again, so a code never moves to another agent; the A-numbers
// (A-01…) stay our own characters'. Pure (zero RN imports).

export type Seat = { room: number; desk: number };

export type Desks = {
  /** Machine (image id) → its room number. Kept after the machine goes, so its number stays retired. */
  rooms: Readonly<Record<string, number>>;
  /** Agent id → its seat. */
  seats: Readonly<Record<string, Seat>>;
  /** The number the next new room gets (from 1). */
  nextRoom: number;
  /** Room number → the desk index its next agent gets (0 is a). */
  nextDesk: Readonly<Record<string, number>>;
};

export const NO_DESKS: Desks = { rooms: {}, seats: {}, nextRoom: 1, nextDesk: {} };

/** A desk's letters: 0 → a, 25 → z, 26 → aa. */
export function deskLetters(index: number): string {
  let n = Math.max(0, Math.floor(index));
  let out = '';
  do {
    out = String.fromCharCode(97 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** "1a", "12c": always lowercase, so it never reads like A-01. */
export function deskCode(seat: Seat): string {
  return `${seat.room}${deskLetters(seat.desk)}`;
}

/** How an agent's desk reads beside its name: "desk 1b" ("desk …" while its seat is not read yet). */
export function deskLabel(seat: Seat | null | undefined): string {
  return seat ? `desk ${deskCode(seat)}` : 'desk …';
}

/** How a machine reads: "room 1" (null while it has no room yet). */
export function roomLabel(room: number | null | undefined): string | null {
  return room != null ? `room ${room}` : null;
}

/** The seat the next agent on [imageId] would get, without giving it out. */
export function peekSeat(d: Desks, imageId: string): Seat {
  const room = d.rooms[imageId] ?? d.nextRoom;
  return { room, desk: d.nextDesk[String(room)] ?? 0 };
}

/** Gives out the next seat on [imageId]: its room's number (a new one for a machine without) and its next desk. */
export function takeSeat(d: Desks, imageId: string): { seat: Seat; desks: Desks } {
  const seat = peekSeat(d, imageId);
  const known = d.rooms[imageId] != null;
  return {
    seat,
    desks: {
      ...d,
      rooms: known ? d.rooms : { ...d.rooms, [imageId]: seat.room },
      nextRoom: known ? d.nextRoom : d.nextRoom + 1,
      nextDesk: { ...d.nextDesk, [String(seat.room)]: seat.desk + 1 },
    },
  };
}

/** [d] with [agentId] at [seat]. */
export function bindSeat(d: Desks, agentId: string, seat: Seat): Desks {
  return { ...d, seats: { ...d.seats, [agentId]: seat } };
}

/**
 * Seats every agent that has none, oldest first ([agents] in that order),
 * and drops a deleted agent's seat (its code stays retired). The same
 * object when nothing changed.
 */
export function seatAgents(d: Desks, agents: readonly { id: string; imageId: string }[]): Desks {
  let out = d;
  const here = new Set(agents.map((a) => a.id));
  for (const a of agents) {
    if (out.seats[a.id]) continue;
    const taken = takeSeat(out, a.imageId);
    out = bindSeat(taken.desks, a.id, taken.seat);
  }
  const gone = Object.keys(out.seats).filter((id) => !here.has(id));
  if (gone.length === 0) return out;
  const seats = { ...out.seats };
  for (const id of gone) delete seats[id];
  return { ...out, seats };
}

const count = (v: unknown, min: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= min ? v : null;

/** Kept desks from storage; anything malformed is left out (a dropped agent is seated again). */
export function readDesks(raw: unknown): Desks {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rooms: Record<string, number> = {};
  for (const [k, v] of Object.entries((o.rooms as Record<string, unknown>) ?? {})) {
    const n = count(v, 1);
    if (n != null) rooms[k] = n;
  }
  const seats: Record<string, Seat> = {};
  for (const [k, v] of Object.entries((o.seats as Record<string, unknown>) ?? {})) {
    const s = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
    const room = count(s.room, 1);
    const desk = count(s.desk, 0);
    if (room != null && desk != null) seats[k] = { room, desk };
  }
  const nextDesk: Record<string, number> = {};
  for (const [k, v] of Object.entries((o.nextDesk as Record<string, unknown>) ?? {})) {
    const n = count(v, 0);
    if (n != null) nextDesk[k] = n;
  }
  // Never below a number already out, so a damaged counter can't give one again.
  const used = [...Object.values(rooms), ...Object.values(seats).map((s) => s.room)];
  const nextRoom = Math.max(count(o.nextRoom, 1) ?? 1, ...used.map((r) => r + 1));
  for (const s of Object.values(seats)) {
    const key = String(s.room);
    nextDesk[key] = Math.max(nextDesk[key] ?? 0, s.desk + 1);
  }
  return { rooms, seats, nextRoom, nextDesk };
}
