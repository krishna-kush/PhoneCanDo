// The ground every scene stands on: the site's amber blueprint grid fading
// out from a point (as lines, as dots, or as a floor running off to a
// horizon, by the look), a red glow, and the night and dawn a scene can
// dial in. A scene sets it each frame; what it leaves out falls back to the
// rest.

import { alpha } from '../color.ts';
import { el } from '../el.ts';
import type { Ground } from '../looks.ts';
import type { Stage } from '../stage.ts';
import { COLOR } from '../theme.ts';

export type Sky = {
  /** The grid's strength, 0 to 1. */
  grid?: number;
  /** Where the grid shows most, as a share of the frame. */
  gx?: number;
  gy?: number;
  /** How far the grid has slid, in u. */
  dx?: number;
  dy?: number;
  /** Zoom on the grid. */
  zoom?: number;
  glow?: number;
  glowX?: number;
  glowY?: number;
  /** The glow's reach, in u. */
  glowR?: number;
  night?: number;
  dawn?: number;
};

const REST: Required<Sky> = { grid: 1, gx: 0.5, gy: 0.5, dx: 0, dy: 0, zoom: 1, glow: 0.7, glowX: 0.5, glowY: 0.5, glowR: 60, night: 0, dawn: 0 };

export type Backdrop = { set: (sky: Sky) => void };


/** The ground for [ground], its red glow [glow] times as strong as the dark scheme's. */
export function makeBackdrop(parent: HTMLElement, st: Stage, ground: Ground = 'lines', glow = 1): Backdrop {
  const layer = el('div', 'layer');
  parent.prepend(layer);
  const grid = el('div', `sky-grid${ground === 'dots' ? ' dots' : ''}`, layer);
  // A floor: the grid laid flat and running off, a faint flat one above it.
  const floor = ground === 'floor' ? el('div', 'sky-floor', layer) : null;
  const shine = el('div', 'sky-glow', layer);
  const dark = el('div', 'sky-night', layer);
  const dawn = el('div', 'sky-dawn', layer);
  const red = (a: number) => alpha(COLOR.primary, a * glow);
  dark.style.background = `linear-gradient(to bottom, ${alpha(COLOR.termBlue, 0.16)}, ${alpha(COLOR.termBg, 0.75)})`;
  dawn.style.background = `radial-gradient(120% 70% at 50% 100%, ${alpha(COLOR.secondary, 0.38)}, ${alpha(COLOR.primary, 0.12)} 45%, transparent 75%)`;
  return {
    set(sky) {
      const s = { ...REST, ...sky };
      grid.style.opacity = (s.grid * (floor ? 0.4 : 1)).toFixed(3);
      grid.style.transform = `translate(${(s.dx * st.u).toFixed(1)}px, ${(s.dy * st.u).toFixed(1)}px) scale(${s.zoom.toFixed(4)})`;
      grid.style.maskImage = `radial-gradient(65% 75% at ${(s.gx * 100).toFixed(1)}% ${(s.gy * 100).toFixed(1)}%, #000 0%, transparent 85%)`;
      if (floor) {
        floor.style.opacity = s.grid.toFixed(3);
        floor.style.backgroundPosition = `${(s.dx * 2 * st.u).toFixed(1)}px ${(-s.dy * 3 * st.u).toFixed(1)}px`;
      }
      shine.style.opacity = s.glow.toFixed(3);
      shine.style.background = `radial-gradient(circle ${(s.glowR * st.u).toFixed(0)}px at ${(s.glowX * 100).toFixed(1)}% ${(s.glowY * 100).toFixed(1)}%, ${red(0.2)}, ${red(0.06)} 45%, transparent 100%)`;
      dark.style.opacity = s.night.toFixed(3);
      dawn.style.opacity = s.dawn.toFixed(3);
    },
  };
}
