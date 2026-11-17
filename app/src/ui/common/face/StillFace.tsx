import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { PLAIN, type Look } from '../../../../../mascot/look.ts';
import { PARTS } from './change/parts';
import FaceDrawing, { type Moving, PixelHeart } from './FaceDrawing';
import { faceLayout } from './layout';
import type { Mood } from './mood';
import { dropStyle, eyeStyle, heartStyle, LID, liftStyle, LOOK, pupilStyle, REST, zStyle } from './motion';

type Props = {
  mood: Mood;
  /** The body's short side in dp (the mark's square). */
  size?: number;
  /** Its design, shape and inks (mascot/look.ts); A-01's own when left out. */
  mascot?: Look;
  /** Feet on the box's bottom, not centred: a row of faces stands on one line. */
  stand?: boolean;
};

// Plain views: a still face only ever hands them plain styles.
const STILL = { View, Text } as unknown as Moving;

// A face that never moves, for a page of them (a picker's choices): drawn
// as AgentFace rests when still (motion.ts's REST and LOOK), in plain
// views, with no animation set up at all, so sixty of them mount at once
// without a wait.
// One that blinks, hops or floats hearts is an AgentFace.
export default function StillFace({ mood, size = 24, mascot = PLAIN, stand = false }: Props) {
  const layout = useMemo(() => faceLayout(mascot, size, stand), [mascot, size, stand]);
  return (
    <FaceDrawing
      layout={layout}
      parts={PARTS[mood]}
      moving={STILL}
      motion={{
        body: liftStyle(REST.lift),
        eye: eyeStyle(LID[mood], LOOK[mood], layout.eyeW),
        pupil: pupilStyle(LOOK[mood], layout.eyeW),
        smile: null,
        z: zStyle(REST.drift, layout.mark),
        drop: dropStyle(REST.drift, layout.mark),
        query: null,
      }}
      hearts={1}
      heart={(_, __, place) => <PixelHeart place={place} style={heartStyle(REST.beat, 0, layout.heartH)} view={STILL.View} />}
    />
  );
}
