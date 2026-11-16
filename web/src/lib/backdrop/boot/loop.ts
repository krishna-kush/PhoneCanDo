// The backdrop's frame loop, for whichever page shows it (boot/margins.ts
// beside the home page's sheet, boot/story.ts on the story page): sizes each
// canvas to its stretch of the view, measures the page's parts, follows
// scroll and pointer, says what anything clicked says, and runs the frame
// loop while the page shows the backdrop and the tab is in view. When nothing
// is moving the world it draws at a lower rate, and once nobody has scrolled,
// pointed or clicked for a while it draws one last frame and sleeps until
// somebody does. Under reduced motion it draws only when something moves it:
// loops stand still, the pointer doesn't sway the camera, and the camera
// keeps to the scroll without easing after it.

import { anyWords, cousinLine, floorWords } from '../../../data/backdrop';
import { cueMascot } from '../../mascotCue';
import type { Camera } from '../camera';
import { readPalette } from '../palette';
import { Playground } from '../play/playground';
import { depth, goal, makeTimeline, type Timeline } from '../story/a07/timeline';
import { readCrew } from '../story/characters/crew';
import { sceneFor } from '../story/floors';
import type { Side } from '../story/room';
import { floorAt, type Band } from '../track';
import { LENS, PITCH } from '../world/building';
import type { Floor, Frame, Pass, View } from '../world/frame';
import { Pokes } from '../world/pokes';
import { render } from '../world/render';
import { fitPass, makePass, sectionHatch } from './canvas';

// How far the pointer moves the eye at the view's edges, world units: across,
// only what lies deeper slides (camera.ts); up and down, everything does.
const SWAY_X = 22;
const SWAY_Y = 34;
// The canvas's resolution at most: past this the margins cost more to fill
// than they gain in sharpness.
const MAX_DPR = 1.5;
// After this long with nothing scrolling, swaying or catching up (ms), the
// world's own loops still run, at this many frames a second.
const QUIET = 1500;
const QUIET_FPS = 20;
// After this long with no scroll, pointer or click (ms), it sleeps.
const IDLE = 12000;
// How quickly the camera catches up with the page and with the pointer (per second, as a rate).
const FOLLOW = 5;
const SWAY_EASE = 3;
// Scroll speed (px a second) at which the units are as startled as they get.
const RUSH = 4000;
// The loop time drawn under reduced motion: every loop mid-way.
const STILL_T = 2.2;
// Little plays its beats at their own pace; more than this many seconds
// behind the scroll, it hurries, faster the further it has to go.
const SLACK = 2.5;
const HURRY = 1.2;

/** Where things stand in a view w × h px. */
export type Layout = {
  /** The sheet's edges on screen; on the story page, the band's (View). */
  left: number;
  right: number;
  band: number | null;
  /** Each canvas's width, CSS px, in the host's order. */
  widths: number[];
  /** The view's centre down the screen: the eye's level. */
  cy: number;
};

/** What a page gives the backdrop. */
export type Host = {
  /** The stage: the view is its size, and its data-crew the crew Little meets. */
  root: HTMLElement;
  /** The canvases and the margin each draws, the right's first: its rooms call the dark down, and Little lives there. */
  canvases: [HTMLCanvasElement, Side][];
  /** While this matches, the backdrop shows and runs. */
  shown: MediaQueryList;
  /** What holds the page's parts: measured again whenever it changes size. */
  sheet: HTMLElement;
  place: (w: number, h: number) => Layout;
  /** Where the camera rides (its y) for the scroll at floor number [floor] of [floors], with Little at floor number [little]. */
  camera: (floor: number, little: number, floors: number) => number;
  /** The page's parts, a floor each, top to bottom, with each floor's key (story/floors.ts). */
  parts: () => { el: HTMLElement; key: string }[];
  /** Whether the left margin's playground plays: the home page's does. */
  playground: boolean;
  /** Told each time the page is measured: its floors' parts, the story's timeline, and the heights the scroll is read against. */
  measured?: (page: Measured) => void;
};

export type Measured = { bands: Band[]; timeline: Timeline; viewH: number; docH: number };

/** The running backdrop, for its page to answer the pointer with. */
export type World = {
  play: Playground;
  pokes: Pokes;
  /** Somebody did something: the world wakes, if it slept. */
  stir: () => void;
  /** [name] (a unit, a toy) says the next of [lines]. */
  say: (name: string, lines: readonly string[]) => void;
  /** Whatever is drawn at a screen point says its line; false when nothing there answers a click. */
  poke: (x: number, y: number) => boolean;
};

export function startWorld(host: Host): World | null {
  const { root, sheet, shown } = host;
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  let pal = readPalette();
  const cam: Camera = { x: 0, y: 0, d: LENS, cx: 0, cy: 0 };
  const passes = host.canvases.map(([canvas, side]) => makePass(canvas, side, cam, pal));
  if (passes.some((p) => p === null)) return null;
  const ready = passes as Pass[];
  const canvases = host.canvases.map(([canvas]) => canvas);
  const pokes = new Pokes();
  const view: View = { w: 0, h: 0, dpr: 1, left: 0, right: 0, band: null };
  const play = new Playground(cam, view);
  const met = new Set<string>();
  const crew = readCrew(root.dataset.crew);
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
  // Loop time stands still while it sleeps, so nothing jumps when it wakes.
  let slept = 0;
  let sleptAt = 0;
  let drawnAt = 0;
  let inputAt = t0;

  const makeHatch = () => sectionHatch(ready[0].pen.ctx, view, pal);

  const measure = () => {
    const w = root.clientWidth;
    const h = root.clientHeight;
    const dpr = Math.min(MAX_DPR, devicePixelRatio || 1);
    const sized = w !== view.w || h !== view.h || dpr !== view.dpr;
    if (sized) {
      Object.assign(view, { w, h, dpr });
      hatch = makeHatch();
    }
    const at = host.place(w, h);
    if (sized || at.left !== view.left || at.right !== view.right || at.band !== view.band) {
      Object.assign(view, { left: at.left, right: at.right, band: at.band });
      at.widths.forEach((width, k) => fitPass(ready[k], canvases[k], view, width));
    }
    cam.cx = (view.left + view.right) / 2;
    cam.cy = at.cy;
    const parts = host.parts();
    bands = parts.map(({ el, key }) => {
      const r = el.getBoundingClientRect();
      return { top: r.top + scrollY, bottom: r.bottom + scrollY, key };
    });
    docH = document.documentElement.scrollHeight;
    if (floors.length !== bands.length || floors.some((f, i) => f.key !== bands[i].key)) {
      floors = bands.map(({ key }) => ({ key, words: floorWords[key] ?? anyWords, scene: sceneFor(key) }));
      timeline = makeTimeline(floors);
      if (host.playground) play.reset(floors.map((floor) => floor.key));
    }
    host.measured?.({ bands, timeline, viewH: view.h, docH });
  };

  const running = () => shown.matches && document.visibilityState === 'visible';

  let busyAt = 0;
  const frame = (ms: number) => {
    raf = 0;
    if (!running() || !view.w) return;
    if (sleptAt) {
      slept += ms - sleptAt;
      sleptAt = 0;
    }
    // An app in flight or in your hand keeps the full rate.
    if (play.moving) busyAt = ms;
    // Quiet: the world's own loops go on at a lower rate.
    const quiet = ms - busyAt > QUIET && !still.matches;
    if (quiet && ms - drawnAt < 1000 / QUIET_FPS - 2) {
      raf = requestAnimationFrame(frame);
      return;
    }
    // Idle: this frame is the last until somebody scrolls, points or clicks.
    const settling = quiet && ms - inputAt > IDLE;
    drawnAt = ms;
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
    // The story clock heads for the rest the scroll has reached, forwards or back.
    const ahead = goal(timeline, floor) - clock;
    if (!placed || calm) clock += ahead;
    else {
      const pace = 1 + Math.max(0, Math.abs(ahead) - SLACK) * HURRY;
      clock += Math.sign(ahead) * Math.min(Math.abs(ahead), pace * dt);
    }
    const target = host.camera(floor, depth(timeline, clock), floors.length);
    // A jump of more than a few floors (an anchor link) cuts rather than pans.
    if (!placed || calm || Math.abs(target - baseY) > PITCH * 3) baseY = target;
    else baseY += (target - baseY) * (1 - Math.exp(-dt * FOLLOW));
    if (host.playground) play.step(dt, Math.floor(floor), floors.length, calm, now);
    const k = 1 - Math.exp(-dt * SWAY_EASE);
    const was = cam.x + cam.y;
    swayX += ((pointer && !calm ? (pointer.x / view.w - 0.5) * 2 * SWAY_X : 0) - swayX) * k;
    swayY += ((pointer && !calm ? (pointer.y / view.h - 0.5) * 2 * SWAY_Y : 0) - swayY) * k;
    cam.x = swayX;
    cam.y = baseY + swayY;
    if (Math.abs(cam.x + cam.y - was) > 0.05 || Math.abs(ahead) > 0.001 || rush > 0.01) busyAt = ms;
    placed = true;
    for (const pass of ready) {
      pass.pen.pal = pal;
      pass.floorsLayer.pen.pal = pal;
    }
    const first = ready[0];
    const drawn: Frame = {
      side: first.side,
      pen: first.pen,
      cam,
      view,
      floors,
      t: calm ? STILL_T : (ms - t0 - slept) / 1000,
      now,
      dt,
      still: calm,
      settling,
      rush: calm ? 0 : rush,
      pointer: calm ? null : pointer,
      pokes,
      play,
      hatch,
      clock,
      timeline,
      actor: null,
      resting: Math.abs(goal(timeline, floor) - clock) < 0.001,
      crew,
      dark: 0,
      lights: [],
      glows: [],
      shade: first.shade,
      floorsLayer: first.floorsLayer,
    };
    render(drawn, ready);
    // The dark the tunnel brought down this frame: the playground's lights answer it next.
    play.dark = drawn.dark;
    if (settling) sleptAt = ms;
    else if (!calm) raf = requestAnimationFrame(frame);
  };

  const request = () => {
    if (!raf && running()) raf = requestAnimationFrame(frame);
  };
  const stir = () => {
    inputAt = performance.now();
    request();
  };
  const halt = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  };

  measure();
  request();

  addEventListener('scroll', stir, { passive: true });
  addEventListener('resize', () => {
    measure();
    stir();
  });
  new ResizeObserver(() => {
    measure();
    request();
  }).observe(sheet);
  shown.addEventListener('change', () => {
    if (!shown.matches) return halt();
    measure();
    request();
  });
  still.addEventListener('change', request);
  document.addEventListener('visibilitychange', () => (running() ? stir() : halt()));
  // The webfonts change every width measured so far.
  document.fonts?.ready.then(() => {
    for (const pass of ready) {
      pass.pen.forget();
      pass.floorsLayer.pen.forget();
      pass.floorsLayer.key = '';
    }
    request();
  });
  new MutationObserver(() => {
    pal = readPalette();
    hatch = makeHatch();
    for (const pass of ready) pass.floorsLayer.key = '';
    stir();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  addEventListener(
    'pointermove',
    (e) => {
      pointer = { x: e.clientX, y: e.clientY };
      busyAt = performance.now();
      stir();
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => (pointer = null));

  const say = (name: string, lines: readonly string[]) => pokes.poke(name, performance.now() / 1000, lines[said++ % lines.length]);

  return {
    play,
    pokes,
    stir,
    say,
    poke: (x, y) => {
      const hit = pokes.find(x, y);
      if (!hit) return false;
      say(hit.name, hit.says ?? (floorWords[hit.key] ?? anyWords).says);
      // A-01 says hello the first time each cousin is clicked.
      if (hit.serial && !met.has(hit.name)) {
        met.add(hit.name);
        cueMascot({ say: cousinLine(hit.serial), move: 'hop' });
      }
      // Under reduced motion nothing else redraws to take the line down.
      if (still.matches) setTimeout(request, 2000);
      return true;
    },
  };
}
