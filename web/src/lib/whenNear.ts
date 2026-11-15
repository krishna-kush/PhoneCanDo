// Runs `start` once, when the visitor nears `el`: as soon as the section two
// above el's section reaches the viewport, or at once when that section is
// already above it (a jump to a later anchor, a reload further down). The
// home page's heavy toys load their code this way, so the first paint
// fetches only what the top of the page needs, and each toy is mounted two
// sections before anyone can see it.

const AHEAD = 2;

export function whenNear(el: Element, start: () => void): void {
  let mark = el.closest('section') ?? el;
  for (let i = 0; i < AHEAD && mark.previousElementSibling; i++) mark = mark.previousElementSibling;
  const reached = (r: DOMRect) => r.top < innerHeight;
  if (!('IntersectionObserver' in window) || reached(mark.getBoundingClientRect())) {
    start();
    return;
  }
  const seen = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting || reached(e.boundingClientRect))) return;
    seen.disconnect();
    start();
  });
  seen.observe(mark);
}
