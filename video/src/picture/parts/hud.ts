// The frame round every scene, the field manual's: a hairline with amber
// registration ticks, the brand top left, the section top right (typed in
// as each scene starts), the address bottom left, a REC timecode, and the
// site's red load bar filling along the top as the video runs.

import { seg } from '../../motion/tween.ts';
import { end } from '../../timeline/script/end.ts';
import { sceneAt, SCENES, startOf, TOTAL, type SceneId } from '../../timeline/scenes.ts';
import { BEAT } from '../../timeline/tempo.ts';
import { el } from '../el.ts';
import { typeOn } from './words.ts';

/** Each scene's section line. */
const SECTIONS: Record<SceneId, string> = {
  ghost: 'Sec. 01 / A phone, left alone',
  reveal: 'Sec. 02 / Somebody, after all',
  title: 'Sec. 03 / The pitch',
  chores: 'Sec. 04 / Phone control',
  scratch: 'Sec. 04 / Phone control',
  apart: 'Sec. 05 / The body, apart',
  terminal: 'Sec. 06 / Linux, on board',
  agents: 'Sec. 07 / Coding agents',
  crew: 'Sec. 08 / The crew',
  night: 'Sec. 09 / Schedules',
  locked: 'Sec. 10 / The gate',
  stamps: 'Sec. 11 / On the device',
  reel: 'Sec. 12 / The pitch, again',
  end: 'Sec. 13 / Get it',
};

export type Hud = { frame: (beat: number) => void };

export function makeHud(parent: HTMLElement, url: string): Hud {
  const hud = el('div', 'hud', parent);
  el('div', 'hud-frame', hud);
  for (const c of ['tl', 'tr', 'bl', 'br']) el('div', `hud-tick ${c}`, hud);
  el('div', 'label hud-brand', hud, 'PhoneCanDo field manual · FM-01');
  const sec = el('div', 'label hud-sec', hud);
  el('div', 'label hud-url', hud, url);
  const rec = el('div', 'label hud-rec', hud);
  const dot = el('i', '', rec);
  const time = el('span', '', rec);
  const bar = el('div', 'hud-bar', hud);
  return {
    frame(beat) {
      const { scene, local } = sceneAt(beat);
      // Typed in as each scene starts; the first is there from the first frame.
      typeOn(sec, SECTIONS[scene.id], local, scene.id === SCENES[0].id ? -2 : 0, 0.03);
      const s = Math.floor(beat * BEAT);
      time.textContent = `REC 00:${String(s).padStart(2, '0')}`;
      dot.style.opacity = beat % 1 < 0.5 ? '1' : '0.25';
      bar.style.transform = `scaleX(${Math.min(1, beat / TOTAL).toFixed(4)})`;
      // Gone as the camera pulls out to the cover, so it closes on the cover alone.
      const out = startOf('end') + end.at.pull;
      hud.style.opacity = String(1 - seg(beat, out, out + 1));
    },
  };
}
