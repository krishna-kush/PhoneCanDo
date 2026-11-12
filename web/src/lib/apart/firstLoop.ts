// Calls back once the hero clip has played through while the figure was
// watched (watched.ts). A clip set to loop jumps back to its start, and that
// jump ends a play-through; one nobody saw waits for the next. Until a clip
// lands (site.hero.video empty), a timer of the placeholder's length plays
// the clip's part, paused the same way.

import { watchSeen } from './watched';

// A jump back by more than this is the clip starting over.
const LOOP_JUMP_S = 0.5;

export function afterFirstLoop(figure: HTMLElement, video: HTMLVideoElement | null, loopMs: number, then: () => void) {
  let over = false;
  let left = loopMs;
  let since = 0;
  let timer = 0;
  let last = video?.currentTime ?? 0;

  const fire = () => {
    if (over || !seen.now()) return;
    stop();
    then();
  };

  // No clip yet: a timer stands in for one, running only while watched.
  const run = () => {
    if (video || over || timer || !seen.now()) return;
    since = performance.now();
    timer = window.setTimeout(fire, left);
  };
  const pause = () => {
    if (!timer) return;
    window.clearTimeout(timer);
    timer = 0;
    left = Math.max(0, left - (performance.now() - since));
  };

  const onTime = () => {
    const now = video!.currentTime;
    if (now + LOOP_JUMP_S < last) fire();
    last = now;
  };

  const seen = watchSeen(figure, (on) => (on ? run() : pause()));
  video?.addEventListener('timeupdate', onTime);

  function stop() {
    over = true;
    pause();
    seen.stop();
    video?.removeEventListener('timeupdate', onTime);
  }

  return { stop };
}
