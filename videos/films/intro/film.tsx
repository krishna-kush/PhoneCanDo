// The intro, for the engine: a phone types on its own, the camera dives
// in, and A-01 takes you through the field manual's pages to
// phonecando.app, in one continuous camera. 50 seconds for YouTube,
// LinkedIn and the feeds, in all three shapes.
//
// Its picture is built by hand into one element (picture/mount.ts) rather
// than as React components: every frame sets each element outright from
// the beat, so the element is built once, after the fonts, and drawn at
// each frame Remotion asks for.

import { useLayoutEffect, useRef } from 'react';
import { continueRender, delayRender } from 'remotion';
import { FACTS } from '../../brand/facts/facts.ts';
import { loadFonts } from '../../brand/looks/fonts.ts';
import type { Film } from '../../engine/render/film.ts';
import { useBeat } from '../../engine/stage/Clock.tsx';
import { useStage } from '../../engine/stage/useStage.ts';
import { LINE, TEMPO } from './beats.ts';
import { mount, type Draw } from './picture/mount.ts';
import './picture/style/base.css';
import './picture/style/type.css';
import './picture/style/parts.css';
import './picture/style/apps.css';
import './picture/style/asks.css';
import './picture/style/inside.css';
import './picture/style/crew.css';
import './picture/style/night.css';
import './picture/style/gate.css';
import './picture/style/finale.css';
import './picture/style/stagehands.css';

function Picture() {
  const { w, h } = useStage();
  const beat = useBeat();
  const host = useRef<HTMLDivElement>(null);
  const draw = useRef<Draw | null>(null);
  const now = useRef(beat);
  now.current = beat;

  // Built after the fonts, as the old page did: a scene measures its laid-out text the first time it shows.
  useLayoutEffect(() => {
    const root = host.current;
    if (!root) return;
    let gone = false;
    const hold = delayRender('Building the intro');
    loadFonts().then(() => {
      if (!gone) {
        draw.current = mount(root, w, h, FACTS);
        draw.current(now.current);
      }
      continueRender(hold);
    });
    return () => {
      gone = true;
      draw.current = null;
      root.replaceChildren();
      root.className = 'intro';
      root.removeAttribute('style');
    };
  }, [w, h]);

  useLayoutEffect(() => {
    draw.current?.(beat);
  }, [beat]);

  return <div ref={host} className="intro" />;
}

export const intro: Film = {
  id: 'intro',
  tempo: TEMPO,
  line: LINE,
  fps: 60,
  formats: ['16x9', '9x16', '1x1'],
  Picture,
  sound: true,
};
