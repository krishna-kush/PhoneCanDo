// Settings → About (src/ui/settings/about/copy.ts: the spec plate, the
// boops and their jackpots, the credits, the author and the postcard;
// src/ui/settings/about/postcard/turn.ts: how the plate turns over) and
// Settings → Updates
// (src/ui/settings/updates/copy.ts: the build's label, how a new build
// reaches you, A-01's errand, lite's packing list). Imports the real pure
// modules (Node 22.18+ strips their types), so these cannot drift.
// Run: node test_about_updates.js (or pnpm check:vectors)
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

(async () => {
  const a = await import(src('ui/settings/about/copy.ts'));
  const r = await import(src('ui/settings/about/postcard/turn.ts'));
  const u = await import(src('ui/settings/updates/copy.ts'));
  const lines = await import(src('ui/common/face/lines.ts'));

  // --- about: boops -------------------------------------------------------------
  t('no boops yet: an invite', a.boopCaption(0), 'on duty · tap me');
  t('first boop: the first boop line', a.boopCaption(1), lines.boopLine(0));
  t('ninth boop: a boop line', a.boopCaption(9), lines.boopLine(8));
  t('jackpots every tenth', [0, 9, 10, 11, 20, 30].map(a.isJackpot), [false, false, true, false, true, true]);
  t('the first jackpot', a.boopCaption(10), 'jackpot! best friends now');
  t('the second jackpot', a.boopCaption(20), 'ten more? legend');
  t('later jackpots keep the last line', [a.boopCaption(30), a.boopCaption(90)], ['boop champion, certified', 'boop champion, certified']);

  // --- about: the plate and the credits ----------------------------------------
  const plate = a.plateFields('1.2.3', 45, 'full', 7);
  t('plate terms', plate.map((f) => f.term), ['Model', 'Version', 'Build', 'Channel', 'Lives on', 'Boops']);
  t('plate values', plate.slice(1, 4).map((f) => f.value).concat(plate[5].value), ['v1.2.3', '45', 'full', '7']);
  t('A-01 stars', a.CREDITS[0], { role: 'Starring', name: 'A-01' });
  t('each role once', new Set(a.CREDITS.map((c) => c.role)).size, a.CREDITS.length);

  // --- about: the author and the postcard ------------------------------------------
  t('author keys: no email, phone or city', Object.keys(a.AUTHOR).sort(), ['github', 'handle', 'name']);
  t('author has no @ address', Object.values(a.AUTHOR).some((v) => /\S+@\S+\.\S+/.test(v)), false);
  t('postcard: its lines and signoff', [a.POSTCARD.lines.length > 0, a.POSTCARD.signoff], [true, '— Krishna']);
  t('postcard: three address lines, one per rule', a.POSTCARD.address, ['To: The Curious One', 'Out living a little', "Your phone's got this"]);

  // --- about: turning the plate over ----------------------------------------------
  t('nearest side', [0, 80, 100, -100, 250, 300].map(r.nearestSide).map((n) => n + 0), [0, 0, 180, -180, 180, 360]);
  t('a full width drags a half turn', r.dragAngle(0, 300, 300), 180);
  t('half the width, a quarter', r.dragAngle(180, -150, 300), 90);
  t('no width yet: no turn', r.dragAngle(40, 120, 0), 40);
  t('finger speed in degrees a second', r.turnSpeed(600, 300), 360);
  t('past a third: turns over the way it went', [r.turnTarget(0, 70, 0), r.turnTarget(0, -70, 0)], [180, -180]);
  t('short of a third: settles back', r.turnTarget(0, 50, 0), 0);
  t('a flick finishes a short drag', r.turnTarget(0, 20, 600), 180);
  t('a flick back undoes a long drag', r.turnTarget(0, 100, -600), -180);
  t('from the back, onwards to the face', r.turnTarget(180, 250, 0), 360);
  t('the back shows past a quarter turn', [0, 89, 91, 180, 269, 271, 360].map(r.showsBack), [false, false, true, true, true, false, false]);
  t('either way round', [-91, -180, -271].map(r.showsBack), [true, true, false]);

  // --- updates: channels --------------------------------------------------------
  t('channels', ['full', 'lite', 'play', '', 'beta'].map(u.channelOf), ['full', 'lite', 'play', 'full', 'full']);
  t('tape words', ['full', 'lite', 'play'].map(u.tapeWord), ['Full build', 'Starter build', 'Via Play']);
  t('stamps', ['full', 'lite', 'play'].map(u.labelStamp), ['Delivered', 'Starter', 'Play keeps it']);
  t('label lines', u.labelFields('full', 12).map((f) => f.value), ['12', 'full', 'chat, terminal, eyes and hands']);
  t('only full has eyes and hands', ['lite', 'play'].map((c) => u.labelFields(c, 1)[2].value), ['chat + terminal', 'chat + terminal']);

  // --- updates: the route and the errand ---------------------------------------
  t('full comes from GitHub', u.routeFields('full')[0].value, 'Our GitHub releases');
  t('play comes from Play', u.routeFields('play')[0].value, 'Google Play');
  t('route terms', u.routeFields('full').map((f) => f.term), ['From', 'When', 'Install']);
  t('errand lines', ['idle', 'running', 'back'].map((e) => u.courierLine('full', e)), [
    'on the porch, waiting for parcels',
    'running to GitHub…',
    'back · the answer pops up',
  ]);
  t('play never runs', u.courierLine('play', 'running'), 'Play brings them, I just wave');

  // --- updates: lite's box ------------------------------------------------------
  t('in the box', u.LITE_BOX.filter((i) => i.inBox).map((i) => i.name), ['Chat', 'Terminal']);
  t('only in the full build', u.LITE_BOX.filter((i) => !i.inBox).map((i) => i.name), ['Eyes', 'Hands']);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
