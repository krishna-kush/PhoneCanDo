// FIG. 01 opens the page apart (PhoneApart.astro marks it before the first
// paint) while the hero clip loads behind its poster, then goes back
// together and plays the clip from its start. It closes once a short hold
// has run, so the parts are seen even when the clip is ready at once, and
// the clip can play through; both count only while the phone is watched
// (watched.ts), so it never closes off screen. The hold fills the ring round
// the screen's play glyph (PlayCue.astro); a clip still loading after it
// shows the loader instead. A press or drag on the phone first leaves it to
// the visitor: it never closes by itself then, and the clip plays as soon as
// it can. Reduced motion starts whole and just plays; Save-Data fetches
// nothing until that press. Until a clip lands (site.hero.video empty), the
// hold alone decides.

import { watchSeen } from './watched';

const HOLD_MS = 5000;
// Still not ready this long after the hold, the clip is played where it is
// and paused at its first frame: some browsers (iOS Safari) only fetch a
// clip once it plays.
const STALL_MS = 4000;
// A longer gap between frames is a tab that was away, not hold time.
const MAX_FRAME_MS = 100;

type Connection = { saveData?: boolean };

export function wireAutoplay(
  wrap: HTMLElement,
  figure: HTMLElement,
  video: HTMLVideoElement | null,
  ring: SVGElement | null,
  close: (then: () => void) => void
) {
  const saveData = (navigator as Navigator & { connection?: Connection }).connection?.saveData === true;
  // Save-Data with a clip to fetch: no hold, the press starts it.
  const waitForPress = saveData && video !== null;
  const play = () => {
    if (video?.paused) void video.play().catch(() => {});
  };

  // Reduced motion: whole from the start, nothing to hold.
  if (!wrap.hasAttribute('data-apart')) {
    if (!saveData) play();
    return { cancel: play };
  }

  let done = false;
  let ready = !video;
  let held = 0;
  let last = 0;
  let frame = 0;
  let stall = 0;

  const settle = () => {
    if (done || !ready || held < HOLD_MS || !seen.now()) return;
    finish();
    close(play);
  };
  const onReady = () => {
    ready = true;
    window.clearTimeout(stall);
    settle();
  };
  const onPlaying = () => {
    if (done) return;
    video!.pause();
    onReady();
  };

  const tick = (now: number) => {
    held = Math.min(HOLD_MS, held + Math.min(MAX_FRAME_MS, now - last));
    last = now;
    ring?.style.setProperty('stroke-dashoffset', String(100 - (100 * held) / HOLD_MS));
    if (held < HOLD_MS) return void (frame = requestAnimationFrame(tick));
    frame = 0;
    // The ring is full: a clip still loading shows the loader now.
    wrap.removeAttribute('data-holding');
    if (!ready)
      stall = window.setTimeout(() => {
        video!.addEventListener('playing', onPlaying, { once: true });
        play();
      }, STALL_MS);
    settle();
  };
  const run = () => {
    if (done || frame || held >= HOLD_MS || waitForPress) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  };
  const pause = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };

  const seen = watchSeen(figure, (on) => {
    if (on) run();
    else pause();
    settle();
  });

  // The clip is marked preload="none" for Save-Data; everyone else fetches
  // it now, behind the poster.
  if (video && !waitForPress) {
    video.addEventListener('canplaythrough', onReady, { once: true });
    video.preload = 'auto';
    if (video.networkState !== HTMLMediaElement.NETWORK_LOADING) video.load();
  }

  function finish() {
    done = true;
    pause();
    window.clearTimeout(stall);
    seen.stop();
    wrap.removeAttribute('data-holding');
  }

  return {
    /** The visitor took the phone over: it never closes by itself now. */
    cancel() {
      if (!done) finish();
      play();
    },
  };
}
