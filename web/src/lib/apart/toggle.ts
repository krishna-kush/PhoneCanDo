// FIG. 01A's press and pull (components/sections/hero/apart): a press takes
// the hero phone apart or puts it back; a mouse drag scrubs --x on the phone
// (0 whole, 1 apart) and lets go past halfway. Touch only presses, so a
// swipe over the phone still scrolls the page. Other presses (the hint under
// the phone) flip it through the same path with `flip`; `open` takes it
// apart without a press (lib/apart/autoplay.ts).
//
// The figure says where it is through attributes on its wrap: data-apart
// while apart, data-settled once the layers have stopped springing (hovers
// then answer at once), data-dragging under a drag, data-closing until a
// close has landed, then data-slam for the stamp.

// A drag this long takes it all the way apart.
const TRAVEL = 220;
// An open has stopped springing by now.
const SETTLE_MS = 1100;
// A close has dropped its layers and stood the phone up by now.
const LAND_MS = 960;

export type ApartHooks = {
  /** Every flip, as it starts. */
  changed: (apart: boolean) => void;
  /** Each close, once the phone stands whole again. */
  landed: () => void;
};

export function wireToggle(
  toggle: HTMLButtonElement,
  wrap: HTMLElement,
  phone: HTMLElement,
  still: MediaQueryList,
  on: ApartHooks
): { flip: () => void; open: () => void } {
  let apart = false;
  let startY: number | null = null;
  let from = 0;
  let dragged = false;
  let timer = 0;

  const at = (y: number) => Math.min(1, Math.max(0, from + ((startY ?? y) - y) / TRAVEL));
  const later = (ms: number, run: () => void) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(run, still.matches ? 0 : ms);
  };
  const set = (next: boolean) => {
    if (next === apart) return;
    apart = next;
    wrap.toggleAttribute('data-apart', apart);
    wrap.toggleAttribute('data-closing', !apart);
    wrap.removeAttribute('data-settled');
    toggle.setAttribute('aria-pressed', String(apart));
    toggle.setAttribute('aria-label', apart ? 'Put the phone back together' : 'Take the phone apart');
    on.changed(apart);
    if (apart) return later(SETTLE_MS, () => wrap.setAttribute('data-settled', ''));
    later(LAND_MS, () => {
      wrap.removeAttribute('data-closing');
      wrap.removeAttribute('data-slam');
      void wrap.offsetWidth;
      wrap.setAttribute('data-slam', '');
      on.landed();
    });
  };

  // A press with a mouse or finger leaves focus where it was: kept on the
  // phone, a later key (F11, F12, Esc, Shift) would bring up its keyboard
  // ring. Tab then Enter still focuses it.
  toggle.addEventListener('mousedown', (e) => e.preventDefault());
  toggle.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || still.matches) return;
    startY = e.clientY;
    from = apart ? 1 : 0;
    dragged = false;
    toggle.setPointerCapture(e.pointerId);
  });
  toggle.addEventListener('pointermove', (e) => {
    if (startY === null) return;
    if (!dragged && Math.abs(e.clientY - startY) < 4) return;
    dragged = true;
    wrap.setAttribute('data-dragging', '');
    wrap.removeAttribute('data-settled');
    phone.style.setProperty('--x', String(at(e.clientY)));
  });
  const end = (e: PointerEvent) => {
    if (startY === null) return;
    const x = at(e.clientY);
    startY = null;
    wrap.removeAttribute('data-dragging');
    phone.style.removeProperty('--x');
    if (!dragged) return;
    if ((x > 0.5) === apart) {
      // Let go on the side it started: it springs back, then settles.
      if (apart) later(SETTLE_MS, () => wrap.setAttribute('data-settled', ''));
      return;
    }
    set(x > 0.5);
  };
  toggle.addEventListener('pointerup', end);
  toggle.addEventListener('pointercancel', end);
  toggle.addEventListener('click', () => {
    if (dragged) return void (dragged = false);
    set(!apart);
  });

  return { flip: () => set(!apart), open: () => set(true) };
}
