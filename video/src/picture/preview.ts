// The page for a person (`pnpm preview`): the frame fitted to the window,
// a bar to play it with its sound (out/audio/mix.wav, when `pnpm sound`
// has made it) and scrub it. Space plays; arrows step a beat, with Shift a
// bar.

import { BEAT } from '../timeline/tempo.ts';
import { el } from './el.ts';
import type { Stage } from './stage.ts';

const CSS = `
.pv-bar { position: fixed; left: 0; right: 0; bottom: 0; height: 48px; display: flex; gap: 12px; align-items: center;
  padding: 0 14px; background: var(--panel); border-top: 1px solid var(--line); font: 500 13px var(--mono); color: var(--fg); }
.pv-bar button { font: inherit; color: var(--on-primary); background: var(--red); border: 0; padding: 7px 14px; cursor: pointer; }
.pv-bar input { flex: 1; accent-color: var(--red); }
`;

export function startPreview(st: Stage, frame: (seconds: number) => void, length: number) {
  el('style', '', document.head, CSS);
  const bar = el('div', 'pv-bar', document.body);
  const play = el('button', '', bar, 'Play');
  const range = el('input', '', bar);
  range.type = 'range';
  range.min = '0';
  range.max = String(length);
  range.step = '0.001';
  const time = el('span', '', bar);
  const audio = new Audio('/video/out/audio/mix.wav');
  audio.preload = 'auto';

  let t = 0;
  let playing = false;
  let clock = 0;
  const fit = () => {
    const s = Math.min(innerWidth / st.w, (innerHeight - 48) / st.h);
    st.root.style.transform = `translate(${(innerWidth - st.w * s) / 2}px, 0) scale(${s})`;
  };
  const draw = () => {
    frame(t);
    range.value = String(t);
    time.textContent = `${t.toFixed(2)} s · beat ${(t / BEAT).toFixed(2)}`;
  };
  const seek = (to: number) => {
    t = Math.max(0, Math.min(length, to));
    audio.currentTime = t;
    clock = performance.now() / 1000 - t;
    draw();
  };
  const toggle = () => {
    playing = !playing;
    play.textContent = playing ? 'Pause' : 'Play';
    if (playing) {
      if (t >= length) seek(0);
      clock = performance.now() / 1000 - t;
      audio.currentTime = t;
      audio.play().catch(() => {});
    } else audio.pause();
  };
  const loop = () => {
    if (playing) {
      t = !audio.paused && audio.readyState > 2 ? audio.currentTime : performance.now() / 1000 - clock;
      if (t >= length) {
        t = length;
        toggle();
      }
      draw();
    }
    requestAnimationFrame(loop);
  };

  play.onclick = toggle;
  range.oninput = () => seek(Number(range.value));
  addEventListener('resize', fit);
  addEventListener('keydown', (e) => {
    if (e.key === ' ') toggle();
    else if (e.key === 'ArrowRight') seek(t + BEAT * (e.shiftKey ? 4 : 1));
    else if (e.key === 'ArrowLeft') seek(t - BEAT * (e.shiftKey ? 4 : 1));
    else if (e.key === 'Home') seek(0);
    else return;
    e.preventDefault();
  });
  fit();
  draw();
  loop();
}
