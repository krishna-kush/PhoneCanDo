// Desk codes (src/state/logic/desks.ts): each machine a room numbered as it
// takes its first agent, each agent a desk letter in its room, each the
// first free one. Imports the real pure module (Node 22.18+ strips its
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

  // Seating: agents without a seat, oldest first, in the first free room and desk.
  const all = (...pairs) => pairs.map(([id, imageId]) => ({ id, imageId }));
  let s = d.seatAgents(d.NO_DESKS, all(['a', 'm1'], ['b', 'm2'], ['c', 'm1'], ['e', 'm3']));
  const code = (id) => d.deskCode(s.seats[id]);
  t('the example phone', ['a', 'b', 'c', 'e'].map(code), ['1a', '2a', '1b', '3a']);
  t('nothing new: the same object', d.seatAgents(s, all(['a', 'm1'], ['b', 'm2'], ['c', 'm1'], ['e', 'm3'])) === s, true);
  t('peek gives nothing out', [d.deskCode(d.peekSeat(s, 'm1')), d.deskCode(d.peekSeat(s, 'm1'))], ['1c', '1c']);
  t('a new machine peeks the next room', d.deskCode(d.peekSeat(s, 'm9')), '4a');
  const bound = d.bindSeat(s, 'n', 'm9', d.peekSeat(s, 'm9'));
  t('bind seats the agent and gives its machine the room', [d.deskCode(bound.seats.n), bound.rooms.m9], ['4a', 4]);

  // 1a 2a 3a 4a on machines of their own; 3a is deleted with its machine.
  s = d.seatAgents(d.NO_DESKS, all(['a', 'm1'], ['b', 'm2'], ['c', 'm3'], ['e', 'm4']));
  s = d.seatAgents(s, all(['a', 'm1'], ['b', 'm2'], ['e', 'm4']));
  t('a deleted agent loses its seat and its gone machine its room', [s.seats.c, s.rooms.m3], [undefined, undefined]);
  t('the next new machine takes the free room', d.deskCode(d.peekSeat(s, 'm5')), '3a');
  t('the others keep theirs', ['a', 'b', 'e'].map(code), ['1a', '2a', '4a']);

  // 1a 1b 1c share a machine; 1b is deleted.
  s = d.seatAgents(d.NO_DESKS, all(['a', 'm1'], ['b', 'm1'], ['c', 'm1']));
  s = d.seatAgents(s, all(['a', 'm1'], ['c', 'm1'], ['f', 'm1']));
  t('the next agent there takes the free desk', code('f'), '1b');
  t('then the next after the last', d.deskCode(d.peekSeat(s, 'm1')), '1d');

  // Storage.
  t('round trip', d.readDesks(JSON.parse(JSON.stringify(s))), s);
  t('junk reads as nothing', d.readDesks('x'), d.NO_DESKS);
  const old = d.readDesks({ rooms: { m1: 1, gone: 2 }, seats: { a: { room: 1, desk: 0 }, bad: { room: 0, desk: 1 } }, nextRoom: 3, nextDesk: { 1: 4 } });
  t('old storage: the counters are left out', old, { rooms: { m1: 1, gone: 2 }, seats: { a: { room: 1, desk: 0 } } });
  t('old storage: a gone machine still holds its room until the next seating', d.deskCode(d.peekSeat(old, 'm7')), '3a');
  t('old storage: then its room is free', d.deskCode(d.peekSeat(d.seatAgents(old, all(['a', 'm1'])), 'm7')), '2a');
  t('old storage: a free desk below the old counter is given', d.deskCode(d.peekSeat(old, 'm1')), '1b');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
