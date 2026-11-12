// A note's flight across the floor plan: a folded slip of paper that follows
// the way route.ts gives it, through doors and along the hall, at an even
// speed. Points are the stage's own (px from its top left); the note is
// placed by its transform, which a flight animates. readPlan measures the
// rooms, doors, hall and chute the way is planned on.

import type { Plan, Point } from './route';

export type { Point };

const rel = (r: DOMRect, s: DOMRect) => ({
  left: r.left - s.left,
  right: r.right - s.left,
  top: r.top - s.top,
  bottom: r.bottom - s.top,
});

export const centerOf = (el: Element, stage: HTMLElement): Point => {
  const r = el.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  return { x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top };
};

export const pointIn = (e: PointerEvent, stage: HTMLElement): Point => {
  const s = stage.getBoundingClientRect();
  return { x: e.clientX - s.left, y: e.clientY - s.top };
};

/** The rooms, their doors, the hall and the chute, as the stage lays them out now. */
export function readPlan(stage: HTMLElement, chute: HTMLElement): Plan {
  const s = stage.getBoundingClientRect();
  const grid = stage.querySelector<HTMLElement>('.plan-rooms');
  const runner = chute.parentElement;
  const rooms = [...stage.querySelectorAll<HTMLElement>('[data-room]')].map((room) => {
    const door = room.querySelector('.room-door')?.getBoundingClientRect();
    const box = rel(room.getBoundingClientRect(), s);
    return { ...box, door: door ? door.left + door.width / 2 - s.left : box.right - 27 };
  });
  const lowest = Math.max(...rooms.map((r) => r.bottom));
  const runnerTop = runner ? runner.getBoundingClientRect().top - s.top : lowest + 18;
  const area = grid ? rel(grid.getBoundingClientRect(), s) : { left: 0, right: s.width };
  const mouth = centerOf(chute, stage);
  return {
    rooms,
    hall: (lowest + runnerTop) / 2,
    lanes: [area.left / 2, (area.right + s.width) / 2],
    rowGap: grid ? parseFloat(getComputedStyle(grid).rowGap) || 10 : 10,
    chute: { x: mouth.x, y: runnerTop + 2 },
  };
}

const at = (p: Point, turn = 0) => `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) rotate(${turn}deg)`;

export function place(note: HTMLElement, p: Point, turn = 0) {
  note.style.transform = at(p, turn);
}

/** A note on the stage at [p]; [marked]: it has been through the runner, so it says who it is from. */
export function makeNote(stage: HTMLElement, p: Point, marked = false): HTMLElement {
  const note = document.createElement('span');
  note.className = 'plan-note';
  note.setAttribute('aria-hidden', 'true');
  note.toggleAttribute('data-marked', marked);
  place(note, p);
  stage.append(note);
  return note;
}

/** px per ms a note travels, and the shortest and longest a flight takes. */
const SPEED = 1.25;
const MIN_MS = 260;
const MAX_MS = 1200;

/** Flies [note] along [way] at an even speed, tumbling a little; resolves when it lands. */
export function fly(note: HTMLElement, way: Point[], still: boolean): Promise<void> {
  const points = way.filter((p, i) => i === 0 || p.x !== way[i - 1].x || p.y !== way[i - 1].y);
  const end = points[points.length - 1];
  place(note, end);
  if (still || points.length < 2) return Promise.resolve();
  const legs = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  const length = legs.reduce((a, b) => a + b, 0);
  let gone = 0;
  const frames = points.map((p, i) => {
    if (i > 0) gone += legs[i - 1];
    const last = i === points.length - 1;
    return { transform: at(p, last ? 0 : Math.sin(i * 1.7) * 12), offset: length ? gone / length : i / (points.length - 1) };
  });
  const ms = Math.min(MAX_MS, Math.max(MIN_MS, length / SPEED));
  return note
    .animate(frames, { duration: ms, easing: 'cubic-bezier(0.45, 0, 0.35, 1)' })
    .finished.then(
      () => undefined,
      () => undefined,
    );
}
