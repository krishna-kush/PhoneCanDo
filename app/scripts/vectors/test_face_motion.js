// A face's moving parts (src/ui/common/face/motion.ts): each style at a
// point of its loop, as the live face draws it on the UI thread, and the
// rest pose a still face is drawn in (the live face's when paused), so a
// picker's still faces match the one that moves. Then its changes of mood
// (src/ui/common/face/change/): which change each pair of moods plays,
// when its pieces happen, how its parts hand over, and how a change cut
// short carries on. Imports the real pure modules (Node 22.18+ strips
// their types), so these cannot drift.
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
  const sp = await import(src('ui/common/face/change/specs.ts'));
  const tm = await import(src('ui/common/face/change/timing.ts'));
  const pt = await import(src('ui/common/face/change/parts.ts'));
  const sh = await import(src('ui/common/face/change/shift.ts'));

  // --- at rest (a still face, or a live one paused) --------------------------------
  t('rest: no hop', r(m.liftStyle(m.REST.lift)), { transform: [{ translateY: 0 }] });
  t('rest: eyes ahead', r(m.pupilStyle(m.LOOK.busy, 10)), { transform: [{ translateX: 0 }] });
  t('rest: awake looks a little right, as the site does', r(m.pupilStyle(m.LOOK.awake, 10)), { transform: [{ translateX: 1.1 }] });
  t('rest: the "z" halfway, in full', r(m.zStyle(m.REST.drift, 10)), { opacity: 1, transform: [{ translateY: 0 }] });
  t('rest: the drop halfway, in full', r(m.dropStyle(m.REST.drift, 10)), { opacity: 1, transform: [{ translateY: 4 }, { rotate: '45deg' }] });
  t('rest: one heart halfway up', r(m.heartStyle(m.REST.beat, 0, 12)), { opacity: 1, transform: [{ translateY: -6 }] });
  t('lids by mood', [m.LID.awake, m.LID.asleep, m.LID.oops], [1, 0.15, 0.45]);
  t('happy shuts its eyes in its smile', m.LID.happy, m.LID.asleep);

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
  const R = sp.REACTION, G = R.glare, D = R.doze, W = R.wake;
  const lids = (c) => c.steps.map((s) => s.lid);
  t('wakers go asleep to awake', [G, W].map((r) => [r.from, r.to]), [['asleep', 'awake'], ['asleep', 'awake']]);
  t('doze goes awake to asleep', [D.from, D.to], ['awake', 'asleep']);
  t("each ends on its mood's own lid", Object.values(R).every((r) => r.steps[r.steps.length - 1].lid === m.LID[r.to]), true);
  t('a last step holds nothing', Object.values(R).every((r) => r.steps[r.steps.length - 1].hold === 0), true);

  // glare, the theme sweep's lights coming on
  t('glare naps a beat before the light hits', G.sleepMs, 250);
  t('glare squints tighter than a frown, but its pupils show', [G.steps[0].lid < m.LID.oops, G.steps[0].lid > m.LID.asleep], [true, true]);
  t('glare winces down', G.lean > 0, true);
  t('glare: the "z" goes as the squint comes', [tm.handOverAtMs(G), G.handOverMs], [250, 70]);
  t('glare keeps its length', tm.changeMs(G), 650);

  // doze and wake: any face dozing off or coming to, and the sweep's lights going out
  t('doze: droop half shut, a heavy blink, drag up, drift shut', lids(D), [0.5, m.LID.asleep, 0.4, m.LID.asleep]);
  t('doze never goes wide', lids(D).every((l) => l <= m.LID.awake), true);
  t('doze nods down', D.lean > 0, true);
  t('doze: the "z" fades in as the lids meet', [tm.handOverAtMs(D), D.handOverMs], [tm.lidsDoneMs(D), 150]);
  t('doze: its steps', [tm.stepAtMs(D, 1), tm.stepAtMs(D, 3), tm.lidsDoneMs(D), tm.changeMs(D)], [500, 860, 1310, 1460]);
  t('wake: half open, a blink, then open', lids(W), [0.5, m.LID.asleep, m.LID.awake]);
  t('wake never squints', W.steps.every((s) => s.lid >= m.LID.asleep), true);
  t('wake stretches up', W.lean < 0, true);
  t('wake: the "z" drifts off before the lids open', [tm.handOverAtMs(W) < W.sleepMs, tm.handOverAtMs(W) + W.handOverMs], [true, 450]);
  t('wake: its steps', [tm.stepAtMs(W, 0), tm.stepAtMs(W, 2), tm.changeMs(W)], [300, 900, 1200]);
  t('the "z" is first in full at Z_SHOWN', [m.zStyle(m.Z_SHOWN, 10).opacity, m.zStyle(m.Z_SHOWN - 0.05, 10).opacity < 1], [1, true]);
  t("asleep's z keeps its float", [m.Z_FLOAT_MS, m.Z_WAIT_MS], [1800, 500]);

  // --- which change a change of mood plays -----------------------------------------
  const of = sp.changeOf;
  t('coming to: the slow wake', [lids(of('asleep', 'awake', false)), of('asleep', 'busy', false).sleepMs], [lids(W), W.sleepMs]);
  t('a tap: jolted awake, wide, then open', lids(of('asleep', 'awake', true)), [1.25, m.LID.awake]);
  t('a jolt is all at once, the hop its lift', [sp.JOLT.sleepMs, sp.JOLT.lean, tm.handOverAtMs(sp.JOLT), tm.changeMs(sp.JOLT)], [0, 0, 0, 360]);
  t('waking into a frown opens only so far', [lids(of('asleep', 'oops', false)).at(-1), lids(of('asleep', 'oops', true)).at(-1)], [m.LID.oops, m.LID.oops]);
  t('dozing off from any open-eyed mood', ['awake', 'busy', 'oops', 'sweaty'].every((f) => of(f, 'asleep', false) === D && of(f, 'asleep', true) === D), true);
  t('between open-eyed moods: a blend', [lids(of('awake', 'busy', false)), of('awake', 'busy', false).steps[0].ms, tm.changeMs(of('busy', 'oops', false))], [[1], sp.BLEND_MS, sp.BLEND_MS]);
  t('into a smile: a blend, the eyes squinting shut', [lids(of('awake', 'happy', true)), of('awake', 'happy', true).lean], [[m.LID.happy], 0]);
  t('out of a smile or a nap into one: a blend', [of('happy', 'asleep', false).steps.length, of('asleep', 'happy', true).steps.length], [1, 1]);
  t('the same mood again: a blend', lids(of('asleep', 'asleep', true)), [m.LID.asleep]);
  t('a blend hands over as it starts', [tm.handOverAtMs(of('awake', 'sweaty', false)), of('awake', 'sweaty', false).handOverMs], [0, sp.BLEND_MS]);
  t('every change ends on its new mood\'s lid', ['awake', 'busy', 'asleep', 'oops', 'sweaty', 'happy'].every((f) =>
    ['awake', 'busy', 'asleep', 'oops', 'sweaty', 'happy'].every((to) => [false, true].every((b) => lids(of(f, to, b)).at(-1) === m.LID[to])),
  ), true);

  // --- the parts and their hand-over -------------------------------------------------
  t('every mood but happy has eyes; happy its smile', Object.entries(pt.PARTS).map(([k, p]) => [k, p.includes('eyes'), p.includes('smile')]), [
    ['awake', true, false], ['busy', true, false], ['asleep', true, false], ['oops', true, false], ['sweaty', true, false], ['happy', false, true],
  ]);
  t('asleep has no pupils, only its "z"', [pt.PARTS.asleep.includes('pupils'), pt.PARTS.asleep.includes('z')], [false, true]);
  t('both moods\' parts, once each, in one order', pt.unionOf(pt.PARTS.asleep, pt.PARTS.awake, pt.PARTS.awake), ['eyes', 'pupils', 'z']);
  t('sides: waking brings the pupils, takes the "z", keeps the eyes', [pt.sidesOf('pupils', 'asleep', 'awake'), pt.sidesOf('z', 'asleep', 'awake'), pt.sidesOf('eyes', 'asleep', 'awake')], [[0, 1], [1, 0], [1, 1]]);
  t('a hand-over from 0: from side, halfway, to side', [pt.partWeight([1, 0], 0, 0), pt.partWeight([0, 1], 0.25, 0), pt.partWeight([1, 0], 1, 0)], [1, 0.25, 0]);
  t('a hand-over from 1 runs back to 0', [pt.partWeight([1, 0], 1, 1), pt.partWeight([1, 0], 0, 1)], [1, 0]);
  t('a part on both sides never fades', [0, 0.4, 1].map((o) => pt.partWeight([1, 1], o, 0)), [1, 1, 1]);
  t('a weight times its own fade', [pt.weighted({ opacity: 0.5 }, 0.5).opacity, pt.weighted({}, 0.3).opacity], [0.25, 0.3]);
  t('weighted keeps the rest of the style', pt.weighted(m.liftStyle(3), 1), { transform: [{ translateY: 3 }], opacity: 1 });

  // --- a face's change as React keeps it ---------------------------------------------
  const first = sh.firstShift('asleep', undefined, 0);
  t('appearing: at rest', [first.from, first.to, first.change, first.at, first.id], ['asleep', 'asleep', null, 0, 0]);
  const swept = sh.firstShift('awake', 'glare', 0);
  t('appearing with a reaction plays it', [swept.from, swept.to, swept.change === G], ['asleep', 'awake', true]);
  const woken = sh.shiftTo(first, { to: 'awake', booped: true, now: 1000, snap: false });
  t('a tap wakes it with a jolt', [woken.from, woken.to, lids(woken.change), woken.at, woken.id], ['asleep', 'awake', [1.25, 1], 0, 1]);
  const up = sh.endShift(woken);
  t('played out: at rest, the hand-over at its other end', [up.from, up.to, up.change, up.at, up.id], ['awake', 'awake', null, 1, 1]);
  const dozing = sh.shiftTo(up, { to: 'asleep', booped: false, now: 5000, snap: false });
  t('then it dozes off, its hand-over from 1', [dozing.from, dozing.change === D, dozing.at], ['awake', true, 1]);
  const early = sh.shiftTo(dozing, { to: 'awake', booped: true, now: 5500, snap: false });
  t('a tap mid-doze, eyes still open: they ease back open', [early.from, early.to, lids(early.change), early.at], ['awake', 'awake', [1], 1]);
  const late = sh.shiftTo(dozing, { to: 'awake', booped: true, now: 5000 + 1400, snap: false });
  t('a tap once the "z" is in: a jolt from asleep, from the other end', [late.from, lids(late.change), late.at], ['asleep', [1.25, 1], 0]);
  const snapped = sh.shiftTo(dozing, { to: 'asleep', booped: false, now: 5100, snap: true });
  t('out of sight: taken at once', [snapped.from, snapped.to, snapped.change, snapped.id], ['asleep', 'asleep', null, dozing.id + 1]);
  const named = sh.shiftTo(first, { to: 'awake', reaction: 'glare', booped: true, now: 9000, snap: false });
  t('a reaction given plays instead of the jolt', [named.from, named.change === G], ['asleep', true]);
  t('done a beat after its own length', [sh.endsAfterMs(dozing), sh.endsAfterMs(up)], [1460 + sh.END_SLACK_MS, 0]);
  t('a page reading its state is not played', sh.SETTLE_MS, 300);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
