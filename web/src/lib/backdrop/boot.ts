// Wires the backdrop to the page: sizes a canvas to each margin, measures
// the sheet and its parts, follows scroll and pointer, answers clicks, hands
// the playground's toys to your pointer to pick up and throw (and its empty
// floor, to shake or hold for jiggle mode), and runs the frame loop while the margins are wide enough to show it and the
// tab is in view. When nothing is moving the world it draws at a lower rate,
// and once nobody has scrolled, pointed or clicked for a while it draws one
// last frame and sleeps until somebody does. Under reduced motion it draws
// only when something moves it: loops stand still, the pointer doesn't sway
// the camera, and the camera keeps to the scroll without easing after it.

import { anyWords, cousinLine, floorWords, playWords, voices } from '../../data/backdrop';
import { cueMascot } from '../mascotCue';
import type { Camera } from './camera';
import { Pen } from './paint/pen';
import { readPalette } from './palette';
import { Playground } from './play/playground';
import { goal, makeTimeline, type Timeline } from './story/a07/timeline';
import { readCrew } from './story/characters/crew';
import { sceneFor } from './story/floors';
import { floorAt, type Band } from './track';
import { LENS, PITCH, cameraY } from './world/building';
import type { Floor, Frame, Pass, View } from './world/frame';
import { Pokes } from './world/pokes';
import { render } from './world/render';

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
// The hatch on the cut faces: tile size, CSS px.
const HATCH = 6;

/** [root] holds a canvas for each margin: data-side "left" and "right". */
export function startBackdrop(root: HTMLElement) {
  const page = document.querySelector<HTMLElement>('.page');
  const left = root.querySelector<HTMLCanvasElement>('canvas[data-side="left"]');
  const right = root.querySelector<HTMLCanvasElement>('canvas[data-side="right"]');
  if (!page || !left || !right) return;
  const shown = matchMedia('(min-width: 1440px)');
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  let pal = readPalette();
  const cam: Camera = { x: 0, y: 0, d: LENS, cx: 0, cy: 0 };
  // Each margin's pass (world/render.ts): its canvas and pen, the slabs' own
  // layer, kept while the camera stands still, and the shade the tunnel's
  // dark is laid on first, its lights cut out, then drawn over the world.
  const makePass = (canvas: HTMLCanvasElement, side: -1 | 1): Pass | null => {
    const ctx = canvas.getContext('2d');
    const floorsCtx = document.createElement('canvas').getContext('2d');
    if (!ctx || !floorsCtx) return null;
    return { side, pen: new Pen(ctx, cam, pal), floorsLayer: { pen: new Pen(floorsCtx, cam, pal), key: '' }, shade: document.createElement('canvas'), origin: 0 };
  };
  // The right first: its rooms call the dark down, and Little lives there.
  const passes = [makePass(right, 1), makePass(left, -1)].filter((p): p is Pass => p !== null);
  if (passes.length < 2) return;
  const canvases = [right, left];
  const pokes = new Pokes();
  const view: View = { w: 0, h: 0, dpr: 1, left: 0, right: 0 };
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
    return passes[0].pen.ctx.createPattern(tile, 'repeat');
  };

  /** Sizes margin [k]'s canvas, its layer and its shade to [width] CSS px, in whole device px. */
  const fit = (k: number, width: number) => {
    const pass = passes[k];
    const canvas = canvases[k];
    const px = Math.max(1, Math.round(width * view.dpr));
    const css = px / view.dpr;
    const ph = Math.round(view.h * view.dpr);
    pass.origin = pass.side < 0 ? 0 : view.w - css;
    canvas.style.width = `${css}px`;
    for (const c of [canvas, pass.floorsLayer.pen.ctx.canvas, pass.shade]) {
      if (c.width !== px) c.width = px;
      if (c.height !== ph) c.height = ph;
    }
    pass.floorsLayer.key = '';
  };

  const measure = () => {
    const w = root.clientWidth;
    const h = root.clientHeight;
    const dpr = Math.min(MAX_DPR, devicePixelRatio || 1);
    const sized = w !== view.w || h !== view.h || dpr !== view.dpr;
    if (sized) {
      Object.assign(view, { w, h, dpr });
      hatch = makeHatch();
    }
    const sheet = page.getBoundingClientRect();
    const l = Math.max(0, sheet.left);
    const r = Math.min(w, sheet.right);
    if (sized || l !== view.left || r !== view.right) {
      view.left = l;
      view.right = r;
      fit(0, w - r);
      fit(1, l);
    }
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
      play.reset(floors.map((floor) => floor.key));
    }
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
    const target = cameraY(floor, floors.length);
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
    play.step(dt, Math.floor(floor), floors.length, calm, now);
    const k = 1 - Math.exp(-dt * SWAY_EASE);
    const was = cam.x + cam.y;
    swayX += ((pointer && !calm ? (pointer.x / view.w - 0.5) * 2 * SWAY_X : 0) - swayX) * k;
    swayY += ((pointer && !calm ? (pointer.y / view.h - 0.5) * 2 * SWAY_Y : 0) - swayY) * k;
    cam.x = swayX;
    cam.y = baseY + swayY;
    if (Math.abs(cam.x + cam.y - was) > 0.05 || Math.abs(ahead) > 0.001 || rush > 0.01) busyAt = ms;
    placed = true;
    for (const pass of passes) {
      pass.pen.pal = pal;
      pass.floorsLayer.pen.pal = pal;
    }
    const first = passes[0];
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
    render(drawn, passes);
    // The dark the tunnel brought down this frame: the playground's lights answer it next.
    play.dark = drawn.dark;
    if (settling) sleptAt = ms;
    else if (!calm) raf = requestAnimationFrame(frame);
  };

  const request = () => {
    if (!raf && running()) raf = requestAnimationFrame(frame);
  };
  /** Somebody did something: the world wakes, if it slept. */
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
  }).observe(page);
  shown.addEventListener('change', () => {
    if (!shown.matches) return halt();
    measure();
    request();
  });
  still.addEventListener('change', request);
  document.addEventListener('visibilitychange', () => (running() ? stir() : halt()));
  // The webfonts change every width measured so far.
  document.fonts?.ready.then(() => {
    for (const pass of passes) {
      pass.pen.forget();
      pass.floorsLayer.pen.forget();
      pass.floorsLayer.key = '';
    }
    request();
  });
  new MutationObserver(() => {
    pal = readPalette();
    hatch = makeHatch();
    for (const pass of passes) pass.floorsLayer.key = '';
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

  for (const canvas of canvases) {
    canvas.addEventListener('pointermove', (e) => {
      if (play.held || play.pressing) return play.move(e.clientX, e.clientY, performance.now() / 1000);
      const toy = play.find(e.clientX, e.clientY);
      canvas.style.cursor = toy ? (play.canTake(toy) ? 'grab' : 'pointer') : pokes.find(e.clientX, e.clientY) ? 'pointer' : '';
    });
    canvas.addEventListener('pointerdown', (e) => {
      stir();
      const now = performance.now() / 1000;
      // A toy in the playground: picked up (and woken, if it may be), saying
      // so; or asleep, while someone on its floor is awake to throw at it.
      const got = play.grab(e.clientX, e.clientY, now);
      if (got?.took) {
        pokes.poke(got.toy.name, now, voices.app[said++ % voices.app.length]);
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = 'grabbing';
        return;
      }
      if (got) {
        pokes.poke(got.toy.name, now, playWords.asleep[said++ % playWords.asleep.length]);
        return;
      }
      // A lock: it opens, and says so as anything clicked does.
      play.unlock(e.clientX, e.clientY, now);
      const hit = pokes.find(e.clientX, e.clientY);
      // The playground's empty floor: your hand on it, to shake it or hold it for jiggle mode.
      if (!hit && canvas === left) {
        play.hold(e.clientX, e.clientY, now);
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (!hit) return;
      const says = hit.says ?? (floorWords[hit.key] ?? anyWords).says;
      pokes.poke(hit.name, performance.now() / 1000, says[said++ % says.length]);
      // A-01 says hello the first time each cousin is clicked.
      if (hit.serial && !met.has(hit.name)) {
        met.add(hit.name);
        cueMascot({ say: cousinLine(hit.serial), move: 'hop' });
      }
      // Under reduced motion nothing else redraws to take the line down.
      if (still.matches) setTimeout(request, 2000);
    });
    const letGo = () => {
      if (!play.held && !play.pressing) return;
      const toy = play.held;
      play.drop(performance.now() / 1000);
      canvas.style.cursor = toy ? 'grab' : '';
      stir();
    };
    canvas.addEventListener('pointerup', letGo);
    canvas.addEventListener('pointercancel', letGo);
  }
}
