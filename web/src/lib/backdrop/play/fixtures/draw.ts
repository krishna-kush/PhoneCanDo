// The fixtures drawn on their floors (fixtures/kinds.ts says what they are),
// in the page's line-work, each in its own file under paint/: the dock, the
// Spark, the pit and the seesaw before the floor's toys, the padlock (which
// stands in front of its chute) after them.

import type { Room } from '../../story/room';
import type { Playground } from '../playground';
import { Z, across } from '../toys';
import type { Fixture } from './kinds';
import { drawDock } from './paint/dock';
import { drawPadlock } from './paint/lock';
import { drawPit } from './paint/pit';
import { drawSeesaw } from './paint/seesaw';
import { drawSparkLamp } from './paint/spark';

/** Floor i's fixture: [front] false before its toys, true after them. */
export function drawFixture(room: Room, play: Playground, i: number, fx: Fixture, front: boolean) {
  if ((fx.kind === 'lock') !== front) return;
  const x = room.x(across(play.where.span, fx.at) * room.pen.scale(Z), Z);
  switch (fx.kind) {
    case 'spark':
      return drawSparkLamp(room, play, i, x);
    case 'pit':
      return drawPit(room, play, i, x);
    case 'lock':
      return drawPadlock(room, play, i, x);
    case 'seesaw':
      return drawSeesaw(room, play, fx);
    case 'dock':
      return drawDock(room, play, i, fx);
  }
}
