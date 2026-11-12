// Drag from a handle, told apart from a tap: a press that moves past a few
// pixels is a drag, and the click a drag ends with is swallowed, so the
// handle's own click listener only ever sees taps (and keyboard presses).

export type DragHandlers = {
  /** The press became a drag; false refuses it (the press is then nothing). */
  start(e: PointerEvent): boolean;
  move(e: PointerEvent): void;
  drop(e: PointerEvent): void;
  cancel(): void;
};

const SLOP = 6;

export function dragFrom(handle: HTMLElement, on: DragHandlers) {
  let down: PointerEvent | null = null;
  let dragging = false;
  let swallow = false;

  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    down = e;
    dragging = false;
    swallow = false;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', (e) => {
    if (!down || e.pointerId !== down.pointerId) return;
    if (!dragging) {
      if (Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) < SLOP) return;
      dragging = on.start(e);
      if (!dragging) {
        down = null;
        return;
      }
    }
    on.move(e);
  });
  handle.addEventListener('pointerup', (e) => {
    if (!down || e.pointerId !== down.pointerId) return;
    down = null;
    if (!dragging) return;
    dragging = false;
    swallow = true;
    on.drop(e);
  });
  handle.addEventListener('pointercancel', () => {
    if (dragging) on.cancel();
    down = null;
    dragging = false;
  });
  // The click a drag ends with is not a tap.
  handle.addEventListener(
    'click',
    (e) => {
      if (!swallow) return;
      swallow = false;
      e.stopImmediatePropagation();
      e.preventDefault();
    },
    true,
  );
}
