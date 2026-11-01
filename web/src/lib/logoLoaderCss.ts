import logo from '../../../theme/logo.json';

const { loader, shadow } = logo;
const POSES = loader.poses;
const MAX = Math.max(...POSES.map((p) => Math.max(p.w, p.h)));
const TOTAL =
  POSES.length * loader.holdMs +
  (POSES.length - 1) * loader.morphMs +
  loader.endHoldMs;
const EASE = `cubic-bezier(${loader.ease.join(', ')})`;
const SWAP_EASE = `cubic-bezier(${loader.swapEase.join(', ')})`;

type Pose = (typeof POSES)[number];
type Step = { pose: Pose; time: number };

const steps: Step[] = [{ pose: POSES[0], time: 0 }];
let t = 0;
for (let i = 0; i < POSES.length; i++) {
  t += loader.holdMs;
  steps.push({ pose: POSES[i], time: t });
  if (i < POSES.length - 1) {
    t += loader.morphMs;
    steps.push({ pose: POSES[i + 1], time: t });
  }
}
// The last pose equals pose 0, so this also lengthens the square pause at the
// loop seam.
t += loader.endHoldMs;
steps.push({ pose: POSES[POSES.length - 1], time: t });

const at = (time: number): string => `${((time / TOTAL) * 100).toFixed(3)}%`;
const stretched = (pose: Pose): boolean => pose.w > 1 || pose.h > 1;

function shapeFrame(pose: Pose, time: number): string {
  const left = `calc((var(--pc-s) * ${MAX - pose.w} + ${stretched(pose) ? '0px' : 'var(--pc-lift)'}) / 2)`;
  const top = `calc((var(--pc-s) * ${MAX - pose.h} + ${stretched(pose) ? '0px' : 'var(--pc-lift)'}) / 2)`;
  return `  ${at(time)} {
    left: ${left};
    top: ${top};
    width: calc(var(--pc-s) * ${pose.w});
    height: calc(var(--pc-s) * ${pose.h});
  }`;
}

function swapFrame(pose: Pose, time: number, layer: 'red' | 'yellow', easing: string): string {
  const offset = stretched(pose) ? 'var(--pc-o-lift)' : 'var(--pc-o)';
  const away = layer === 'red' ? pose.swap : !pose.swap;
  const transform = away ? `translate(${offset}, ${offset})` : 'translate(0px, 0px)';
  const z = (layer === 'red') !== pose.swap ? 1 : 0;
  return `  ${at(time)} {
    transform: ${transform};
    z-index: ${z};
    animation-timing-function: ${easing};
  }`;
}

// Share the shape's fast ease while the mark is also morphing, so the stack
// flips while the shape is halfway instead of after it has visually settled.
// A colour-only swap keeps the gentler swap ease.
function swapEase(from: Pose, to?: Pose): string {
  return to && (to.w !== from.w || to.h !== from.h) ? EASE : SWAP_EASE;
}

const square = POSES[0];
const squareLeft = `calc((var(--pc-s) * ${MAX - square.w} + var(--pc-lift)) / 2)`;
const squareTop = `calc((var(--pc-s) * ${MAX - square.h} + var(--pc-lift)) / 2)`;
const shapeFrames = steps.map(({ pose, time }) => shapeFrame(pose, time));
const redFrames = steps.map(({ pose, time }, i) =>
  swapFrame(pose, time, 'red', swapEase(pose, steps[i + 1]?.pose))
);
const yellowFrames = steps.map(({ pose, time }, i) =>
  swapFrame(pose, time, 'yellow', swapEase(pose, steps[i + 1]?.pose))
);

// Generated once in Base.astro from theme/logo.json, so the web loop and the
// app's Animated loop cannot drift. Only size and base shadow offset are set
// per instance by LogoLoader.astro.
export const logoLoaderCss = `
.pc-loader {
  --pc-max: ${MAX};
  --pc-lift: ${shadow.stretchPx}px;
  --pc-o-lift: calc(var(--pc-o) + var(--pc-lift));
  position: relative;
  display: inline-block;
  flex: none;
  isolation: isolate;
  width: calc(var(--pc-s) * var(--pc-max) + var(--pc-o) + var(--pc-lift));
  height: calc(var(--pc-s) * var(--pc-max) + var(--pc-o) + var(--pc-lift));
}
.pc-loader::before,
.pc-loader::after {
  content: '';
  position: absolute;
  left: ${squareLeft};
  top: ${squareTop};
  width: calc(var(--pc-s) * ${square.w});
  height: calc(var(--pc-s) * ${square.h});
}
.pc-loader::before {
  z-index: 1;
  background-color: var(--red);
  animation:
    pc-loader-shape ${TOTAL}ms ${EASE} infinite,
    pc-loader-red ${TOTAL}ms ${SWAP_EASE} infinite;
}
.pc-loader::after {
  z-index: 0;
  background-color: var(--accent);
  transform: translate(var(--pc-o), var(--pc-o));
  animation:
    pc-loader-shape ${TOTAL}ms ${EASE} infinite,
    pc-loader-yellow ${TOTAL}ms ${SWAP_EASE} infinite;
}
@keyframes pc-loader-shape {
${shapeFrames.join('\n')}
}
@keyframes pc-loader-red {
${redFrames.join('\n')}
}
@keyframes pc-loader-yellow {
${yellowFrames.join('\n')}
}
@media (prefers-reduced-motion: reduce) {
  .pc-loader::before,
  .pc-loader::after { animation: none; }
}
`;
