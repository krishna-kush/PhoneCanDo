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

  // --- reactions ------------------------------------------------------------------
  const R = m.REACTION, G = R.glare, S = R.startle, D = R.doze, W = R.wake;
  const lids = (r) => r.steps.map((s) => s.lid);
  t('wakers go asleep to awake', [G, W].map((r) => [r.from, r.to]), [['asleep', 'awake'], ['asleep', 'awake']]);
  t('dozers go awake to asleep', [S, D].map((r) => [r.from, r.to]), [['awake', 'asleep'], ['awake', 'asleep']]);
  t("each ends on its mood's own lid", Object.values(R).every((r) => r.steps[r.steps.length - 1].lid === m.LID[r.to]), true);
  t('a last step holds nothing', Object.values(R).every((r) => r.steps[r.steps.length - 1].hold === 0), true);

  // glare and startle, the theme sweep's
  t('glare naps a beat before the light hits', G.sleepMs, 250);
  t('glare squints tighter than a frown, but its pupils show', [G.steps[0].lid < m.LID.oops, G.steps[0].lid > m.LID.asleep], [true, true]);
  t('glare winces down, startle jumps up', [G.lean > 0, S.lean < 0], [true, true]);
  t('startle goes wider than open, at once', [S.steps[0].lid > m.LID.awake, S.sleepMs], [true, 0]);
  t('startle holds wide a beat, then dozes off slowly', [S.steps[0].hold, S.steps[1].ms], [250, 350]);
  t('glare: the "z" goes as the squint comes', [m.napAtMs('glare'), G.napMs], [250, 70]);
  t('startle: the "z" comes as the lids meet, at once', [m.napAtMs('startle'), S.napMs], [m.lidsDoneMs('startle'), 0]);
  t('the sweep reactions keep their lengths', [m.reactionMs('glare'), m.reactionMs('startle')], [650, 670]);

  // doze and wake, Privacy's guard
  t('doze: droop half shut, a heavy blink, drag up, drift shut', lids(D), [0.5, m.LID.asleep, 0.4, m.LID.asleep]);
  t('doze never goes wide', lids(D).every((l) => l <= m.LID.awake), true);
  t('doze nods down', D.lean > 0, true);
  t('doze: the "z" fades in as the lids meet', [m.napAtMs('doze'), D.napMs], [m.lidsDoneMs('doze'), 150]);
  t('doze: its steps', [m.stepAtMs('doze', 1), m.stepAtMs('doze', 3), m.lidsDoneMs('doze'), m.reactionMs('doze')], [500, 860, 1310, 1460]);
  t('wake: half open, a blink, then open', lids(W), [0.5, m.LID.asleep, m.LID.awake]);
  t('wake never squints', W.steps.every((s) => s.lid >= m.LID.asleep), true);
  t('wake stretches up', W.lean < 0, true);
  t('wake: the "z" drifts off before the lids open', [m.napAtMs('wake') < W.sleepMs, m.napAtMs('wake') + W.napMs], [true, 450]);
  t('wake: its steps', [m.stepAtMs('wake', 0), m.stepAtMs('wake', 2), m.reactionMs('wake')], [300, 900, 1200]);

  // --- the hand-over between awake and asleep ---------------------------------------
  t('the "z" is first in full at Z_SHOWN', [m.zStyle(m.Z_SHOWN, 10).opacity, m.zStyle(m.Z_SHOWN - 0.05, 10).opacity < 1], [1, true]);
  t('awake side: pupils in, no "z"', [m.napPupilStyle(0, 10, 0).opacity, m.napZStyle(m.Z_SHOWN, 10, 0).opacity], [1, 0]);
  t('asleep side: no pupils', m.napPupilStyle(0, 10, 1).opacity, 0);
  t('asleep side: the "z" exactly as asleep draws it', r(m.napZStyle(0.5, 10, 1)), r(m.zStyle(0.5, 10)));
  t('the pupils still look about', r(m.napPupilStyle(-1, 10, 0)).transform, r(m.pupilStyle(-1, 10)).transform);
  t("asleep's z keeps its float", [m.Z_FLOAT_MS, m.Z_WAIT_MS], [1800, 500]);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
