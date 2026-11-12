// While FIG. 01A is apart, the stack leans a few degrees toward a mouse or
// pen anywhere over the hero, eased each frame, and settles flat again when
// the pointer leaves or the phone closes. It turns the phone with the
// `rotate` property, so it adds to the tilt in `transform` without touching
// it. Touch and reduced motion stay still.

// Degrees at the hero's edge: about the vertical axis, then the horizontal.
const MAX_TURN = 8;
const MAX_NOD = 5;
// Share of the way to the target covered each frame.
const EASE = 0.1;

export function wireLean(area: HTMLElement, figure: HTMLElement, phone: HTMLElement, still: MediaQueryList) {
  let apart = false;
  let aimTurn = 0;
  let aimNod = 0;
  let turn = 0;
  let nod = 0;
  let frame = 0;

  const step = () => {
    turn += (aimTurn - turn) * EASE;
    nod += (aimNod - nod) * EASE;
    const angle = Math.hypot(turn, nod);
    if (angle < 0.02 && aimTurn === 0 && aimNod === 0) {
      phone.style.removeProperty('rotate');
      frame = 0;
      return;
    }
    // A small turn then nod is one turn about the axis between them.
    phone.style.rotate = `${(nod / angle).toFixed(3)} ${(turn / angle).toFixed(3)} 0 ${angle.toFixed(2)}deg`;
    frame = requestAnimationFrame(step);
  };
  const run = () => {
    if (!frame) frame = requestAnimationFrame(step);
  };
  const rest = () => {
    aimTurn = 0;
    aimNod = 0;
    run();
  };

  area.addEventListener('pointermove', (e) => {
    if (!apart || e.pointerType === 'touch' || still.matches) return;
    const a = area.getBoundingClientRect();
    const f = figure.getBoundingClientRect();
    const x = (e.clientX - (f.left + f.width / 2)) / (a.width / 2);
    const y = (e.clientY - (f.top + f.height / 2)) / (a.height / 2);
    aimTurn = Math.max(-1, Math.min(1, x)) * MAX_TURN;
    aimNod = Math.max(-1, Math.min(1, -y)) * MAX_NOD;
    run();
  });
  area.addEventListener('pointerleave', rest);

  return {
    /** Lean only while apart; closing settles it flat. */
    set(next: boolean) {
      apart = next;
      if (!apart) rest();
    },
  };
}
