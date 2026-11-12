// The floor plan's post. A note leaves its room by the door, runs along the
// hall into the runner's chute, comes out marked as from an agent, and goes
// by the hall and the next door to whoever gets it (route.ts). There it lands
// by the runner's rules (rules.ts): read mid-run, waking its agent, left for
// the next turn or in the inbox. One to an agent with no phone tools never
// gets that far: the runner refuses it and sends it back. A woken agent
// writes back, which can wake the first in turn, until the hop limit says a
// reply to a reply wakes no one.

import { cueMascot } from '../mascotCue';
import { toyLines } from '../../data/mascot';
import { centerOf, fly, makeNote, readPlan, type Point } from './flight';
import { later, restart, slamGlass, type Floor } from './floor';
import { between, fromChute, toChute } from './route';
import { land, sayLanded, stampFor, type Why } from './rules';
import { nudge, setState, setWaiting, slam, tallyUp, type Seat } from './seats';
import type { Turns } from './turns';

export type To = { seat: Seat } | { all: 'machine' | 'phone' };

/** Copies of a note to everyone leave the chute this far apart (ms). */
const FAN = 110;
/** A woken agent writes back this long after it wakes, and its turn ends this long after that (ms). */
const ANSWER = 1300;
const SIGN_OFF = 700;

// The quiet outcomes are inked amber; the ones worth a look, red.
const AMBER: Why[] = ['mid-run', 'next-turn', 'inbox', 'broadcast'];

const MASCOT: Partial<Record<Why, () => Parameters<typeof cueMascot>[0]>> = {
  woke: () => ({ say: toyLines.crew.woke, move: 'hop' }),
  'no-tools': () => ({ say: toyLines.crew.refused, move: 'shake' }),
  hop: () => ({ say: toyLines.crew.hop, move: 'shake' }),
  'switch-off': () => ({ say: toyLines.crew.dnd }),
  stopped: () => ({ say: toyLines.crew.stopped, move: 'shake' }),
};

export function makePost(floor: Floor, turns: Turns) {
  const { stage, chute, limits } = floor;
  const at = (el: Element) => centerOf(el, stage);
  const flight = (note: HTMLElement, way: Point[]) => fly(note, way, floor.still.matches);

  async function send(from: Seat, to: To, hop: number, start: Point = at(from.bot)) {
    const everyone = 'all' in to;
    const targets = everyone
      ? floor.seats.filter((s) => s !== from && (to.all === 'phone' || s.room === from.room))
      : [to.seat];
    restart(from.el, 'data-writing');
    if (targets.length === 0) {
      slamGlass(floor, ['Nobody else here', `${from.name} has its machine to itself`]);
      floor.say(`Nobody else is on ${from.name}'s machine.`);
      cueMascot({ say: toyLines.crew.nobody, move: 'shake' });
      return;
    }
    const note = makeNote(stage, start);
    await flight(note, toChute(readPlan(stage, chute), start));
    note.remove();
    restart(chute, 'data-gulp');
    if (everyone) cueMascot({ say: toyLines.crew.everyone, move: 'hop' });
    const plan = readPlan(stage, chute);
    await Promise.all(
      targets.map(
        (seat, i) =>
          new Promise<void>((done) =>
            later(i * FAN, () => {
              // No phone tools: the runner refuses it at once.
              if (land(seat, { hop, broadcast: everyone }, limits).lands === 'refused') {
                arrive(seat, from, hop, everyone);
                if (everyone) return done();
                const back = makeNote(stage, plan.chute, true);
                void flight(back, fromChute(plan, at(from.bot))).then(() => {
                  back.remove();
                  done();
                });
                return;
              }
              const copy = makeNote(stage, plan.chute, true);
              void flight(copy, fromChute(plan, at(seat.pile))).then(() => {
                copy.remove();
                arrive(seat, from, hop, everyone);
                done();
              });
            }),
          ),
      ),
    );
  }

  function arrive(seat: Seat, from: Seat, hop: number, everyone: boolean) {
    const { lands, why } = land(seat, { hop, broadcast: everyone }, limits);
    slam(seat, stampFor(why, limits), AMBER.includes(why) ? 'amber' : 'red');
    floor.say(sayLanded(seat.name, from.name, why, limits));
    if (!everyone) {
      const cue = why === 'budget' ? { say: toyLines.crew.budget(limits.wakesPerHour), move: 'shake' as const } : MASCOT[why]?.();
      if (cue) cueMascot(cue);
    }
    switch (lands) {
      case 'refused':
        nudge(seat, 'shake');
        return;
      case 'read':
        nudge(seat, 'gulp');
        return;
      case 'woke':
        wake(seat, from, hop);
        return;
      case 'pile':
        setWaiting(seat, seat.waiting + 1);
        turns.readPile(seat);
    }
  }

  // Woken: it jolts awake, reads what waited, writes back (one hop deeper)
  // and, its answer sent, goes idle again.
  function wake(seat: Seat, from: Seat, hop: number) {
    seat.wakes += 1;
    tallyUp(seat);
    nudge(seat, 'jolt');
    window.clearTimeout(seat.timer);
    setState(seat, 'working');
    turns.readPile(seat);
    turns.renderNotice();
    seat.timer = later(ANSWER, () => {
      if (seat.state !== 'working') return;
      void send(seat, { seat: from }, hop + 1);
      seat.timer = later(SIGN_OFF, () => turns.endTurn(seat));
    });
  }

  /** A note nobody took goes back to [from] from [p], by the doors. */
  async function returnTo(from: Seat, p: Point) {
    const note = makeNote(stage, p);
    await flight(note, between(readPlan(stage, chute), p, at(from.bot)));
    note.remove();
  }

  /** Let go past the phone's edge: it bounces off the glass and comes back. */
  function offPhone(from: Seat, p: Point) {
    const box = stage.getBoundingClientRect();
    const edge = { x: Math.min(Math.max(p.x, 12), box.width - 12), y: Math.min(Math.max(p.y, 12), box.height - 12) };
    slamGlass(floor, ['Stays on this phone', 'no server · no cloud in between']);
    floor.say('Notes never leave the phone: agents on another phone can’t get them.');
    cueMascot({ say: toyLines.crew.offPhone, move: 'shake' });
    void returnTo(from, edge);
  }

  return { send, returnTo, offPhone };
}
