// Whether a figure is being watched: at least half of it on screen in a
// visible tab. Calls back on every change of either.

// Share of the figure that has to be on screen to count as watched.
const SEEN = 0.5;

export function watchSeen(el: HTMLElement, changed: (seen: boolean) => void) {
  let onScreen = false;
  const now = () => onScreen && !document.hidden;
  const sync = () => changed(now());

  const io = new IntersectionObserver(
    ([entry]) => {
      onScreen = entry.intersectionRatio >= SEEN;
      sync();
    },
    { threshold: [0, SEEN, 1] }
  );
  io.observe(el);
  document.addEventListener('visibilitychange', sync);

  return {
    now,
    stop() {
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
    },
  };
}
