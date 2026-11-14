// The crew's whole performance: for each member, where it goes and what it
// does, written shot by shot (shots/) in running order. Pure.

import type { Act } from './acts.ts';
import { CAST, type Member } from './cast.ts';
import { tripLen, type How, type Station } from './moves.ts';
import { chores } from './shots/chores.ts';
import { crew } from './shots/crew.ts';
import { dawn } from './shots/dawn.ts';
import { gate } from './shots/gate.ts';
import { lights } from './shots/lights.ts';
import { song } from './shots/song.ts';
import { tools } from './shots/tools.ts';

export type Part = { stations: Station[]; acts: Act[] };

/** What a shot writes a member's part with. */
export type Script = {
  /** Sends [member] somewhere. Stations go down in time order. */
  go(member: Member, station: Station): void;
  act(member: Member, act: Act): void;
  /** Where [member] was last sent. */
  whereIs(member: Member): { x: number; y: number };
  /** Sends [member] from where it is to [x, y] at [speed] u a beat, setting off at [at]; when it gets there. */
  trip(member: Member, at: number, x: number, y: number, how: How, speed: number): number;
};

function write(): ReadonlyMap<number, Part> {
  const parts = new Map<number, Part>(CAST.map((m) => [m.index, { stations: [{ at: -1e9, x: m.bunk.x, y: m.bunk.y }], acts: [] }]));
  const partOf = (m: Member) => parts.get(m.index) as Part;
  const script: Script = {
    go: (m, station) => {
      partOf(m).stations.push(station);
    },
    act: (m, act) => {
      partOf(m).acts.push(act);
    },
    whereIs: (m) => {
      const { stations } = partOf(m);
      return stations[stations.length - 1];
    },
    trip: (m, at, x, y, how, speed) => {
      const from = script.whereIs(m);
      const len = tripLen(Math.hypot(x - from.x, y - from.y), speed);
      script.go(m, { at, x, y, len, how });
      return at + len;
    },
  };
  for (const shot of [lights, crew, tools, gate, chores, song, dawn]) shot(script);
  for (const [index, part] of parts) {
    for (let i = 1; i < part.stations.length; i++) {
      if (part.stations[i].at < part.stations[i - 1].at) throw new Error(`Member ${index}'s stations are out of order at beat ${part.stations[i].at}.`);
    }
  }
  return parts;
}

export const SCRIPT = write();
