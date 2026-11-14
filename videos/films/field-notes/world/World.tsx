// The world as the camera sees it: the page, and on it the phone cut open
// with the crew inside, in the part of the frame above the narrator's
// strip. The page's grid slides and grows with the camera, so the phone
// reads as drawn on it.

import { Ground } from '../../../brand/parts/ground/Ground.tsx';
import { Camera } from '../../../engine/stage/Camera.tsx';
import { useBeat } from '../../../engine/stage/Clock.tsx';
import { useStage } from '../../../engine/stage/useStage.ts';
import { Cast } from '../cast/Cast.tsx';
import { knockAt, viewAt } from './camera.ts';
import { Phone } from './Phone.tsx';

/** The grid's square at zoom 1, in u. */
const CELL = 6;

/** [height]: how much of the frame the world gets, from its top, in u. */
export function World({ height }: { height: number }) {
  const beat = useBeat();
  const st = useStage();
  const view = viewAt(beat);
  const anchor = { x: st.W / 2, y: height / 2 };
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: st.w, height: height * st.u, overflow: 'hidden' }}>
      <Ground dx={anchor.x - view.x * view.zoom} dy={anchor.y - view.y * view.zoom} cell={CELL * view.zoom} />
      <Camera {...view} anchor={anchor} shake={knockAt(beat)}>
        <Phone beat={beat} />
        <Cast beat={beat} />
      </Camera>
    </div>
  );
}
