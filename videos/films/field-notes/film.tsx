// Field Notes, for the engine: a night documentary about the crew inside a
// phone, whose narrator is wrong every time. The picture is the world (the
// phone cut open, the crew in it), your fingerprint on the lens, the site's
// first screen at the end, and the narrator's strip along the bottom.

import { LookFrame } from '../../brand/looks/LookFrame.tsx';
import type { Film } from '../../engine/render/film.ts';
import { useStage } from '../../engine/stage/useStage.ts';
import { LINE, TEMPO } from './beats.ts';
import { EndCard } from './end/EndCard.tsx';
import { Fingerprint } from './lens/Fingerprint.tsx';
import { Strip, STRIP } from './strip/Strip.tsx';
import { World } from './world/World.tsx';

function Picture() {
  const { H } = useStage();
  return (
    <LookFrame>
      <World height={H - STRIP} />
      <Fingerprint height={H - STRIP} />
      <EndCard />
      <Strip />
    </LookFrame>
  );
}

export const fieldNotes: Film = {
  id: 'field-notes',
  tempo: TEMPO,
  line: LINE,
  fps: 60,
  formats: ['16x9'],
  Picture,
  sound: true,
};
