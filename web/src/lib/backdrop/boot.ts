// Wires the backdrop to the page: sizes the canvas to the viewport, measures
// the sheet and its parts, follows scroll and pointer, answers clicks, and
// runs the frame loop while the margins are wide enough to show it and the
// tab is in view. Under reduced motion it draws only when something moves
// it: loops stand still, the pointer doesn't sway the camera, and the camera
// keeps to the scroll without easing after it.

import { anyWords, cousinLine, floorWords } from '../../data/backdrop';
import { cueMascot } from '../mascotCue';
import type { Camera } from './camera';
import { Pen } from './paint/pen';
import { readPalette } from './palette';
import { goal, makeTimeline, type Timeline } from './story/a07/timeline';
import { sceneFor } from './story/floors';
import { floorAt, type Band } from './track';
import { LENS, PITCH, cameraY } from './world/building';
import type { Walker } from './world/crowd';
import type { Floor, View } from './world/frame';
import { Pokes } from './world/pokes';
import { render } from './world/render';

// How far the pointer swings the camera at the view's edges, world units.
const SWAY_X = 70;
const SWAY_Y = 34;
// How quickly the camera catches up with the page and with the pointer (per second, as a rate).
const FOLLOW = 5;
const SWAY_EASE = 3;
// Scroll speed (px a second) at which the units are as startled as they get.
const RUSH = 4000;
// The loop time drawn under reduced motion: every loop mid-way.
const STILL_T = 2.2;
// A-07 plays its beats at their own pace; more than this many seconds
// behind the scroll, it hurries, faster the further it has to go.
const SLACK = 2.5;
const HURRY = 1.2;
// The hatch on the cut faces: tile size, CSS px.
const HATCH = 6;

export function startBackdrop(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  const page = document.querySelector<HTMLElement>('.page');
  if (!ctx || !page) return;
  const shown = matchMedia('(min-width: 1440px)');
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  let pal = readPalette();
  const cam: Camera = { x: 0, y: 0, d: LENS, cx: 0, cy: 0 };
  const pen = new Pen(ctx, cam, pal);
  const pokes = new Pokes();
  const crowds = new Map<string, Walker[]>();
  const view: View = { w: 0, h: 0, dpr: 1, left: 0, right: 0 };
  const met = new Set<string>();
  let bands: Band[] = [];
  let floors: Floor[] = [];
  let timeline: Timeline = makeTimeline([]);
  let clock = 0;
  let docH = 0;
  let hatch: CanvasPattern | null = null;
  let pointer: { x: number; y: number } | null = null;
  let raf = 0;
  let last = 0;
  let placed = false;
  let baseY = 0;
  let swayX = 0;
  let swayY = 0;
  let lastScroll = scrollY;
  let rush = 0;
  let said = 0;
  const t0 = performance.now();

  const makeHatch = () => {
    const tile = document.createElement('canvas');
    tile.width = tile.height = Math.round(HATCH * view.dpr);
    const g = tile.getContext('2d');
    if (!g) return null;
    g.scale(view.dpr, view.dpr);
    g.fillStyle = pal.bg;
    g.fillRect(0, 0, HATCH, HATCH);
    g.globalAlpha = pal.light ? 0.4 : 0.32;
    g.strokeStyle = pal.ink;
    g.lineWidth = 1;
    g.beginPath();
    // One diagonal, plus its ends from the tiles beside, so the lines join.
    g.moveTo(0, HATCH);
    g.lineTo(HATCH, 0);
    g.moveTo(-1, 1);
    g.lineTo(1, -1);
    g.moveTo(HATCH - 1, HATCH + 1);
    g.lineTo(HATCH + 1, HATCH - 1);
    g.stroke();
    return ctx.createPattern(tile, 'repeat');
  };

  const measure = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (w !== view.w || h !== view.h || dpr !== view.dpr) {
      Object.assign(view, { w, h, dpr });
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      hatch = makeHatch();
    }
    const sheet = page.getBoundingClientRect();
    view.left = Math.max(0, sheet.left);
    view.right = Math.min(w, sheet.right);
    cam.cx = (view.left + view.right) / 2;
    cam.cy = h / 2;
    const parts = [...document.querySelectorAll<HTMLElement>('main > section, .page > footer')];
    bands = parts.map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top + scrollY, bottom: r.bottom + scrollY, key: el.id || el.classList[0] || '' };
    });
    docH = document.documentElement.scrollHeight;
    if (floors.length !== bands.length || floors.some((f, i) => f.key !== bands[i].key)) {
      floors = bands.map(({ key }) => ({ key, words: floorWords[key] ?? anyWords, scene: sceneFor(key) }));
      timeline = makeTimeline(floors);
    }
  };

  const running = () => shown.matches && document.visibilityState === 'visible';

  const frame = (ms: number) => {
    raf = 0;
    if (!running() || !view.w) return;
    const now = ms / 1000;
    const dt = last ? Math.min(0.05, now - last) : 0;
    last = now;
    const calm = still.matches;
    const sy = scrollY;
    const speed = dt > 0 ? Math.abs(sy - lastScroll) / dt : 0;
    lastScroll = sy;
    const startle = Math.min(1, speed / RUSH);
    rush += (startle - rush) * Math.min(1, dt * (startle > rush ? 12 : 2));
    const floor = floorAt(bands, sy, view.h, docH);
    const target = cameraY(floor);
    // A jump of more than a few floors (an anchor link) cuts rather than pans.
    if (!placed || calm || Math.abs(target - baseY) > PITCH * 3) baseY = target;
    else baseY += (target - baseY) * (1 - Math.exp(-dt * FOLLOW));
    // The story clock heads for the rest the scroll has reached, forwards or back.
    const ahead = goal(timeline, floor) - clock;
    if (!placed || calm) clock += ahead;
    else {
      const pace = 1 + Math.max(0, Math.abs(ahead) - SLACK) * HURRY;
      clock += Math.sign(ahead) * Math.min(Math.abs(ahead), pace * dt);
    }
    const k = 1 - Math.exp(-dt * SWAY_EASE);
    swayX += ((pointer && !calm ? (pointer.x / view.w - 0.5) * 2 * SWAY_X : 0) - swayX) * k;
    swayY += ((pointer && !calm ? (pointer.y / view.h - 0.5) * 2 * SWAY_Y : 0) - swayY) * k;
    cam.x = swayX;
    cam.y = baseY + swayY;
    placed = true;
    pen.pal = pal;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    render({
      pen,
      cam,
      view,
      floors,
      t: calm ? STILL_T : (ms - t0) / 1000,
      now,
      dt,
      still: calm,
      rush: calm ? 0 : rush,
      pointer: calm ? null : pointer,
      pokes,
      crowds,
      hatch,
      clock,
      timeline,
      actor: null,
    });
    if (!calm) raf = requestAnimationFrame(frame);
  };

  const request = () => {
    if (!raf && running()) raf = requestAnimationFrame(frame);
  };
  const halt = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  };

  measure();
  request();

  addEventListener('scroll', () => still.matches && request(), { passive: true });
  addEventListener('resize', () => {
    measure();
    request();
  });
  new ResizeObserver(() => {
    measure();
    request();
  }).observe(page);
  shown.addEventListener('change', () => {
    if (!shown.matches) return halt();
    measure();
    request();
  });
  still.addEventListener('change', request);
  document.addEventListener('visibilitychange', () => (running() ? request() : halt()));
  document.fonts?.ready.then(request);
  new MutationObserver(() => {
    pal = readPalette();
    hatch = makeHatch();
    request();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  addEventListener('pointermove', (e) => (pointer = { x: e.clientX, y: e.clientY }), { passive: true });
  document.documentElement.addEventListener('pointerleave', () => (pointer = null));

  canvas.addEventListener('pointermove', (e) => {
    canvas.style.cursor = pokes.find(e.clientX, e.clientY) ? 'pointer' : '';
  });
  canvas.addEventListener('pointerdown', (e) => {
    const hit = pokes.find(e.clientX, e.clientY);
    if (!hit) return;
    const { says } = floorWords[hit.key] ?? anyWords;
    pokes.poke(hit.name, performance.now() / 1000, says[said++ % says.length]);
    // A-01 says hello the first time each cousin is clicked.
    if (!met.has(hit.name)) {
      met.add(hit.name);
      cueMascot({ say: cousinLine(hit.serial), move: 'hop' });
    }
    request();
    // Under reduced motion nothing else redraws to take the line down.
    if (still.matches) setTimeout(request, 2000);
  });
}
