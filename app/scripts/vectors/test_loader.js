// The logo loader's loop (src/ui/common/loaderTimeline.ts) over the real
// spec (theme/logo.json): where each moment of the loop is, and that it
// runs forward everywhere, the first morph after the seam included (a
// withDelay chain under withRepeat swept back through every pose there).
// Imports the real pure module (Node 22.18+ strips its types).
// Run: node test_loader.js (or pnpm check:vectors)
'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const q = (s) => JSON.stringify(s);
let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`[${ok ? 'OK  ' : 'FAIL'}] ${name}${ok ? '' : ` got=${q(got)} want=${q(want)}`}`);
}
const src = (...parts) => pathToFileURL(path.join(__dirname, '../../src', ...parts)).href;
const logo = require('../../../theme/logo.json');

(async () => {
  const { loaderAt, loaderLoopMs } = await import(src('ui/common/loaderTimeline.ts'));
  const poses = logo.loader.poses;
  const times = { holdMs: logo.loader.holdMs, morphMs: logo.loader.morphMs, endHoldMs: logo.loader.endHoldMs };
  const linear = (x) => x;
  const at = (ms) => loaderAt(ms, poses, times, linear, linear);
  const round = (p) => ({ shape: Math.round(p.shape * 1000) / 1000, role: Math.round(p.role * 1000) / 1000 });
  const H = times.holdMs;
  const M = times.morphMs;
  const loop = loaderLoopMs(poses.length, times);
  const last = poses.length - 1;

  t('loop: every pose holds, all but the last morph on, the seam holds longer', loop, poses.length * H + last * M + times.endHoldMs);
  t('starts square, red in front', at(0), { shape: 0, role: 0 });
  t('holds the first pose', at(H - 1), { shape: 0, role: 0 });
  t('halfway into the first morph', round(at(H + M / 2)), { shape: 0.5, role: 0 });
  t('second pose reached and held', at(H + M + 1), { shape: 1, role: 0 });
  // Pose 1 → 2 only swaps the inks: the swap takes swapEase.
  const swapOnly = loaderAt(2 * (H + M) - M / 2, poses, times, linear, (x) => x * x);
  t('a colour-only swap takes the swap ease', round(swapOnly), { shape: 1.5, role: 0.25 });
  t('last pose held through the seam', at(loop - 1), { shape: last, role: poses[last].swap ? 1 : 0 });
  t('the last pose looks like the first, so the seam does not show', poses[last], poses[0]);
  t('wraps after a loop', at(loop), at(0));
  t('wraps after many loops', at(5 * loop + H + M / 2), at(H + M / 2));

  // Forward everywhere: one millisecond moves the shape by at most one
  // millisecond of a linear morph, apart from the seam's wrap (same look).
  let worst = 0;
  let backwards = 0;
  for (let ms = 1; ms < 2 * loop; ms++) {
    const a = at(ms - 1).shape;
    const b = at(ms).shape;
    if (ms % loop === 0) continue;
    worst = Math.max(worst, Math.abs(b - a));
    if (b < a) backwards++;
  }
  t('no jump between frames', worst <= 1 / M + 1e-9, true);
  t('never runs backwards', backwards, 0);

  // The first morph after the seam starts from pose 0 and ends at pose 1.
  const firstMorph = [];
  for (let ms = loop + H; ms <= loop + H + M; ms += M / 4) firstMorph.push(round(at(ms)).shape);
  t('the first morph of the second loop goes 0 → 1', firstMorph, [0, 0.25, 0.5, 0.75, 1]);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
