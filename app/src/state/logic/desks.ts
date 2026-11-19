// Desk codes: the user's coding agents by where they sit, as the site's
// floor plan draws a crew. The phone is the floor; each machine (image) is
// a room, numbered as it takes its first agent; each agent has a desk in
// its machine's room, lettered a, b, c… So 1a and 1b share a machine, and
// 2a has one of its own. A new room or desk takes the first free number or
// letter: a deleted agent's desk, or the room of a machine that went with
// its last agent, is the next one given. The A-numbers (A-01…) stay our
// own characters'. Pure (zero RN imports).

export type Seat = { room: number; desk: number };

export type Desks = {
  /** Machine (image id) → its room number, while agents sit there. */
  rooms: Readonly<Record<string, number>>;
  /** Agent id → its seat. */
  seats: Readonly<Record<string, Seat>>;
};

export const NO_DESKS: Desks = { rooms: {}, seats: {} };

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

/** The lowest number from [from] not in [used]. */
function firstFree(used: ReadonlySet<number>, from: number): number {
  let n = from;
  while (used.has(n)) n++;
  return n;
}

/** The seat the next agent on [imageId] gets: its machine's room (the first free one for a machine without) and the room's first free desk. */
export function peekSeat(d: Desks, imageId: string): Seat {
  const seats = Object.values(d.seats);
  const room = d.rooms[imageId] ?? firstFree(new Set([...Object.values(d.rooms), ...seats.map((s) => s.room)]), 1);
  return { room, desk: firstFree(new Set(seats.filter((s) => s.room === room).map((s) => s.desk)), 0) };
}

/** [d] with [agentId] at [seat] on [imageId], whose room it is from now on. */
export function bindSeat(d: Desks, agentId: string, imageId: string, seat: Seat): Desks {
  return { rooms: { ...d.rooms, [imageId]: seat.room }, seats: { ...d.seats, [agentId]: seat } };
}

/**
 * Drops a deleted agent's seat and a gone machine's room, so both are free
 * again, then seats every agent that has none, oldest first ([agents] in
 * that order). The same object when nothing changed.
 */
export function seatAgents(d: Desks, agents: readonly { id: string; imageId: string }[]): Desks {
  const here = new Set(agents.map((a) => a.id));
  const machines = new Set(agents.map((a) => a.imageId));
  const goneSeats = Object.keys(d.seats).filter((id) => !here.has(id));
  const goneRooms = Object.keys(d.rooms).filter((id) => !machines.has(id));
  let out = d;
  if (goneSeats.length > 0 || goneRooms.length > 0) {
    const seats = { ...d.seats };
    for (const id of goneSeats) delete seats[id];
    const rooms = { ...d.rooms };
    for (const id of goneRooms) delete rooms[id];
    out = { rooms, seats };
  }
  for (const a of agents) {
    if (out.seats[a.id]) continue;
    out = bindSeat(out, a.id, a.imageId, peekSeat(out, a.imageId));
  }
  return out;
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
  // Storage from before free desks were given again also kept nextRoom and nextDesk: left out, and the
  // rooms it kept for machines since gone are dropped at the next seating.
  return { rooms, seats };
}
