// A face-up card leans toward a mouse or pen and catches the light where it
// points (the glare reads --mx and --my). Touch scrolls past untouched;
// reduced motion keeps every card flat.

export function tiltCards(cards: Iterable<HTMLElement>, still: MediaQueryList) {
  for (const card of cards) {
    const tilt = card.querySelector<HTMLElement>('.card-tilt');
    const front = card.querySelector<HTMLElement>('.card-front');
    if (!tilt || !front) continue;
    card.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || still.matches || card.dataset.face) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      tilt.style.setProperty('--rx', `${((0.5 - y) * 14).toFixed(1)}deg`);
      tilt.style.setProperty('--ry', `${((x - 0.5) * 16).toFixed(1)}deg`);
      front.style.setProperty('--mx', `${Math.round(x * 100)}%`);
      front.style.setProperty('--my', `${Math.round(y * 100)}%`);
    });
    card.addEventListener('pointerleave', () => {
      for (const name of ['--rx', '--ry']) tilt.style.removeProperty(name);
      for (const name of ['--mx', '--my']) front.style.removeProperty(name);
    });
  }
}
