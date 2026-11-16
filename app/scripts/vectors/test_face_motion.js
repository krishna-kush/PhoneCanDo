// A face's moving parts (src/ui/common/face/motion.ts): each style at a
// point of its loop, as the live face draws it on the UI thread, and the
// rest pose a still face is drawn in (the live face's when paused), so a
// picker's still faces match the one that moves. Imports the real pure
// module (Node 22.18+ strips its types), so these cannot drift.
// Run: node test_face_motion.js (or pnpm check:vectors)
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
// Rounded, so float dust does not fail a match.
const r = (style) => JSON.parse(JSON.stringify(style, (_, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)));

(async () => {
  const m = await import(src('ui/common/face/motion.ts'));

  // --- at rest (a still face, or a live one paused) --------------------------------
  t('rest: no hop', r(m.liftStyle(m.REST.lift)), { transform: [{ translateY: 0 }] });
  t('rest: eyes ahead', r(m.pupilStyle(m.REST.look, 10)), { transform: [{ translateX: 0 }] });
  t('rest: the "z" halfway, in full', r(m.zStyle(m.REST.drift, 10)), { opacity: 1, transform: [{ translateY: 0 }] });
  t('rest: the drop halfway, in full', r(m.dropStyle(m.REST.drift, 10)), { opacity: 1, transform: [{ translateY: 4 }, { rotate: '45deg' }] });
  t('rest: one heart halfway up', r(m.heartStyle(m.REST.beat, 0, 12)), { opacity: 1, transform: [{ translateY: -6 }] });
  t('lids by mood', [m.LID.awake, m.LID.asleep, m.LID.oops], [1, 0.15, 0.45]);

  // --- along the loops ------------------------------------------------------------
  t('the "z" fades in', r(m.zStyle(0.1, 10).opacity), 0.5);
  t('the "z" fades out', r(m.zStyle(0.9, 10).opacity), 0.5);
  t('the "z" starts low and ends high', [r(m.zStyle(0, 10)).transform[0].translateY, r(m.zStyle(1, 10)).transform[0].translateY], [4, -4]);
  t('the drop is gone at both ends', [m.dropStyle(0, 10).opacity, m.dropStyle(1, 10).opacity], [0, 0]);
  t('pupils look a full gaze', r(m.pupilStyle(-1, 10)), { transform: [{ translateX: -2.2 }] });
  t('a heart starts low, unseen', r(m.heartStyle(0, 0, 12)), { opacity: 0, transform: [{ translateY: 4.8 }] });
  t('a heart waits out the pause unseen', m.heartStyle(0.9, 0, 12).opacity, 0);
  t('a later heart is a phase behind', r(m.heartStyle(0, m.REST.beat, 12)), r(m.heartStyle(m.REST.beat, 0, 12)));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
