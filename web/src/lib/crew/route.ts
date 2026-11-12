// The way a note travels on the floor plan: rooms are walled but for their
// door, so a note leaves a room through its door, runs along the hall over
// the runner, and enters the next room through its door. A room in a row
// above the hall (narrow screens stack them) opens onto the gap under it,
// and the note takes the nearer side of the plan down to the hall. Points
// are the stage's own (px from its top left). Pure: no DOM.

export type Point = { x: number; y: number };

export type Room = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** The middle of the door gap in its bottom wall. */
  door: number;
};

export type Plan = {
  rooms: Room[];
  /** The hall's middle, between the lowest rooms and the runner. */
  hall: number;
  /** The free lanes down each side of the plan, left and right. */
  lanes: [number, number];
  /** The gap between two rows of rooms. */
  rowGap: number;
  /** The mouth of the runner's chute, on the hall's floor. */
  chute: Point;
};

/** How far inside a room a note lines up with its door before going through. */
const INSIDE = 14;

const roomAt = (plan: Plan, p: Point) =>
  plan.rooms.find((r) => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom) ?? null;

/** From [p] to the hall: out through its room's door, or down the nearer side lane. */
export function toHall(plan: Plan, p: Point): Point[] {
  const lowest = Math.max(...plan.rooms.map((r) => r.bottom));
  const room = roomAt(plan, p);
  if (room) {
    const inside = { x: room.door, y: room.bottom - INSIDE };
    if (room.bottom >= lowest - 2) return [p, inside, { x: room.door, y: plan.hall }];
    // A room above the hall: under its door, across to the right lane, down.
    const under = room.bottom + plan.rowGap / 2;
    const lane = plan.lanes[1];
    return [p, inside, { x: room.door, y: under }, { x: lane, y: under }, { x: lane, y: plan.hall }];
  }
  if (p.y >= lowest) return [p, { x: p.x, y: plan.hall }];
  const [left, right] = plan.lanes;
  const lane = Math.abs(p.x - left) < Math.abs(p.x - right) ? left : right;
  return [p, { x: lane, y: p.y }, { x: lane, y: plan.hall }];
}

/** From [p] down the runner's chute. */
export const toChute = (plan: Plan, p: Point): Point[] => [
  ...toHall(plan, p),
  { x: plan.chute.x, y: plan.hall },
  plan.chute,
];

/** From the runner's chute up to [p]. */
export const fromChute = (plan: Plan, p: Point): Point[] => toChute(plan, p).reverse();

/** From [a] to [b] without the runner: straight across one room, else by the hall. */
export function between(plan: Plan, a: Point, b: Point): Point[] {
  const room = roomAt(plan, a);
  if (room && room === roomAt(plan, b)) return [a, b];
  return [...toHall(plan, a), ...toHall(plan, b).reverse()];
}
