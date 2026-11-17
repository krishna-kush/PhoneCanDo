// Where the guide draws on a walk: the frame around the spot to tap, whether
// that spot is on screen or scrolled away, and where the bubble goes so it
// never covers the spot. In the guide's own coordinates. Pure (zero RN
// imports).

export type Rect = { x: number; y: number; width: number; height: number };

/** The guide's room: the screen less the bars at its top and bottom. */
export type Room = { width: number; top: number; bottom: number };

/** The chat box's height at the foot of the chat. */
export const FOOT = 76;

/** Two reads of a spot within a pixel: it has stopped moving. */
export function sameRect(a: Rect, b: Rect): boolean {
  return (
    Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1
  );
}

/**
 * Where a spot drawn inside view [view] sits on screen: [inner] is its
 * place in the view in units the view is [across] wide (a web page's CSS
 * pixels).
 */
export function insideOf(view: Rect, inner: Rect, across: number): Rect {
  const k = across > 0 ? view.width / across : 1;
  return { x: view.x + inner.x * k, y: view.y + inner.y * k, width: inner.width * k, height: inner.height * k };
}

/**
 * What to frame of a spot measured at [r]: less its press reach (what it
 * shows), and with [foot] only its last FOOT points (the chat box).
 */
export function frameOf(r: Rect, reach: { x: number; y: number } | undefined, foot: boolean): Rect {
  const rx = reach?.x ?? 0;
  const ry = reach?.y ?? 0;
  const inner = { x: r.x + rx, y: r.y + ry, width: Math.max(0, r.width - 2 * rx), height: Math.max(0, r.height - 2 * ry) };
  if (!foot) return inner;
  const height = Math.min(FOOT, inner.height);
  return { ...inner, y: inner.y + inner.height - height, height };
}

/**
 * The frame against the room: on screen, scrolled out of it above or
 * below, or off to one side (a drawer row not slid in yet).
 */
export function sightOf(f: Rect, room: Room): 'on' | 'above' | 'below' | 'aside' {
  if (f.y + f.height <= room.top + 8) return 'above';
  if (f.y >= room.bottom - 8) return 'below';
  if (f.x + f.width <= 8 || f.x >= room.width - 8) return 'aside';
  return 'on';
}

export type BubbleSpot = {
  /** The bubble's top edge. */
  top: number;
  /** Which side of the frame it sits on; null: no frame to sit by (the foot of the room). */
  side: 'above' | 'below' | null;
};

/**
 * Where a bubble [height] tall goes: on the side of the frame with more
 * room, [gap] away, kept inside the room; with no frame on screen, at the
 * room's foot.
 */
export function bubbleSpot(f: Rect | null, room: Room, height: number, gap: number): BubbleSpot {
  const lowest = room.bottom - height;
  if (!f) return { top: lowest, side: null };
  const above = f.y - room.top;
  const below = room.bottom - (f.y + f.height);
  if (below >= above) return { top: Math.max(room.top, Math.min(lowest, f.y + f.height + gap)), side: 'below' };
  return { top: Math.min(lowest, Math.max(room.top, f.y - gap - height)), side: 'above' };
}

/** Where the tucked guide, [size] across, waits: at the room's foot, [side] in from the edge away from the frame. */
export function tuckedAt(f: Rect | null, room: Room, size: number, side: number): { left: number; top: number } {
  const onRight = f != null && f.x + f.width / 2 > room.width / 2;
  return { left: onRight ? side : room.width - side - size, top: room.bottom - size };
}

/** Where along the bubble its arrow points: under the frame's middle, kept [inset] from its ends. */
export function arrowX(f: Rect, left: number, width: number, inset: number): number {
  const mid = f.x + f.width / 2;
  return Math.max(left + inset, Math.min(left + width - inset, mid)) - left;
}
