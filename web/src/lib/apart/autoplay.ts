// Left alone, FIG. 01 comes apart by itself the first time the hero clip
// loops, so a visitor who only watches the hero still sees the exploded
// view. It only ever takes the phone apart, once, and never puts it back; a
// press or drag on the phone first calls it off for good. The clip only
// counts while the phone is on screen in a visible tab, so a loop nobody saw
// waits for the next one. Until a clip lands (site.hero.video empty), a
// timer of the placeholder's length plays the clip's part, paused the same
// way.

// Share of the phone that has to be on screen to count as watched.
const SEEN = 0.5;
// A jump back by more than this is the clip starting over.
const LOOP_JUMP_S = 0.5;

export function wireAutoApart(figure: HTMLElement, video: HTMLVideoElement | null, loopMs: number, open: () => void) {
  let done = false;
  let seen = false;
  let left = loopMs;
  let since = 0;
  let timer = 0;
  let last = 0;

  const watching = () => seen && !document.hidden;
  const fire = () => {
    if (done || !watching()) return;
    stop();
    open();
  };

  // No clip yet: a timer stands in for one, running only while watched.
  const run = () => {
    if (video || done || timer || !watching()) return;
    since = performance.now();
    timer = window.setTimeout(fire, left);
  };
  const pause = () => {
    if (!timer) return;
    window.clearTimeout(timer);
    timer = 0;
    left = Math.max(0, left - (performance.now() - since));
  };
  const sync = () => (watching() ? run() : pause());

  // A clip set to loop jumps back to its start; that jump is the loop.
  const onTime = () => {
    const now = video!.currentTime;
    if (now + LOOP_JUMP_S < last) fire();
    last = now;
  };

  const io = new IntersectionObserver(
    ([entry]) => {
      seen = entry.intersectionRatio >= SEEN;
      sync();
    },
    { threshold: [0, SEEN, 1] }
  );
  io.observe(figure);
  document.addEventListener('visibilitychange', sync);
  video?.addEventListener('timeupdate', onTime);

  function stop() {
    done = true;
    pause();
    io.disconnect();
    document.removeEventListener('visibilitychange', sync);
    video?.removeEventListener('timeupdate', onTime);
  }

  return {
    /** The visitor took the phone over: it never opens by itself now. */
    cancel() {
      if (!done) stop();
    },
  };
}
