// Desk codes (src/state/logic/desks.ts): each machine a room numbered as it
// takes its first agent, each agent a desk letter in its room, neither ever
// given out again. Imports the real pure module (Node 22.18+ strips its
// types), so these cannot drift.
// Run: node test_desks.js (or pnpm check:vectors)
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
  const d = await import(src('state/logic/desks.ts'));

  t('desk letters', [0, 1, 25, 26, 27, 51, 52].map(d.deskLetters), ['a', 'b', 'z', 'aa', 'ab', 'az', 'ba']);
  t('codes are lowercase', d.deskCode({ room: 12, desk: 2 }), '12c');
  t('labels', [d.deskLabel({ room: 1, desk: 1 }), d.deskLabel(undefined), d.roomLabel(3), d.roomLabel(null)], ['desk 1b', 'desk …', 'room 3', null]);

  // opencode on machine m1, a second on m2, a third sharing m1, then aider on m3.
  let s = d.NO_DESKS;
  const take = (imageId) => {
    const r = d.takeSeat(s, imageId);
    s = r.desks;
    return d.deskCode(r.seat);
  };
  t('the example phone', [take('m1'), take('m2'), take('m1'), take('m3')], ['1a', '2a', '1b', '3a']);
  t('peek gives nothing out', [d.deskCode(d.peekSeat(s, 'm1')), d.deskCode(d.peekSeat(s, 'm1'))], ['1c', '1c']);
  t('a new machine peeks the next room', d.deskCode(d.peekSeat(s, 'm9')), '4a');

  // Seating: agents without a seat, oldest first; the deleted ones' seats go, their codes stay retired.
  let seated = d.seatAgents(d.NO_DESKS, [
    { id: 'a', imageId: 'm1' },
    { id: 'b', imageId: 'm2' },
    { id: 'c', imageId: 'm1' },
  ]);
  const code = (id) => d.deskCode(seated.seats[id]);
  t('seated oldest first', ['a', 'b', 'c'].map(code), ['1a', '2a', '1b']);
  t('nothing new: the same object', d.seatAgents(seated, [{ id: 'a', imageId: 'm1' }, { id: 'b', imageId: 'm2' }, { id: 'c', imageId: 'm1' }]) === seated, true);
  seated = d.seatAgents(seated, [{ id: 'a', imageId: 'm1' }, { id: 'b', imageId: 'm2' }]);
  t('a deleted agent loses its seat', seated.seats.c, undefined);
  seated = d.seatAgents(seated, [{ id: 'a', imageId: 'm1' }, { id: 'b', imageId: 'm2' }, { id: 'e', imageId: 'm1' }]);
  t('its desk is not given again', code('e'), '1c');
  seated = d.seatAgents(seated, [{ id: 'a', imageId: 'm1' }, { id: 'e', imageId: 'm1' }, { id: 'f', imageId: 'm4' }]);
  t('a gone room is not given again', code('f'), '3a');

  // Storage.
  t('round trip', d.readDesks(JSON.parse(JSON.stringify(seated))), seated);
  t('junk reads as nothing', d.readDesks('x'), d.NO_DESKS);
  const damaged = d.readDesks({ rooms: { m1: 1 }, seats: { a: { room: 5, desk: 3 }, bad: { room: 0, desk: 1 } }, nextRoom: 1, nextDesk: {} });
  t('a damaged counter never goes below a number out', [damaged.nextRoom, damaged.nextDesk['5']], [6, 4]);
  t('a malformed seat is left out', damaged.seats.bad, undefined);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
