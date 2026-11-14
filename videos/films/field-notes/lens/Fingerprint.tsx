// Your fingerprint, pressed on the lens: the one thing that opens the
// gate. It draws itself ridge by ridge over the scan, in front of
// everything, then flashes and lifts off as the gate is armed.

import { outCubic } from '../../../engine/motion/ease.ts';
import { seg } from '../../../engine/motion/tween.ts';
import { useBeat } from '../../../engine/stage/Clock.tsx';
import { useStage } from '../../../engine/stage/useStage.ts';
import { MOMENTS } from '../script/moments.ts';

/** The ridges: arches one inside the next, each with a leg down either side. */
const RIDGES = [3, 6, 9, 12, 15, 18, 21];

/** Half the print's box, in u. */
const SIZE = 30;

/** [height]: the part of the frame above the strip, in u; the print sits in its middle. */
export function Fingerprint({ height }: { height: number }) {
  const beat = useBeat();
  const { u, W } = useStage();
  const [from, to] = MOMENTS.gate.scan;
  if (beat < from || beat > to + 0.8) return null;
  const drawn = seg(beat, from, to - 0.2, outCubic);
  const lifted = seg(beat, to, to + 0.8, outCubic);
  return (
    <svg
      viewBox={`${-SIZE} ${-SIZE} ${SIZE * 2} ${SIZE * 2}`}
      style={{ position: 'absolute', left: (W / 2 - SIZE) * u, top: (height / 2 - SIZE) * u, width: SIZE * 2 * u, height: SIZE * 2 * u, overflow: 'visible', opacity: 1 - lifted, transform: `scale(${1 + lifted * 0.35})` }}
    >
      <ellipse cx={0} cy={2} rx={25} ry={28} style={{ fill: 'var(--bg)' }} opacity={0.82 * Math.min(1, drawn * 3)} />
      {RIDGES.map((r, i) => {
        // Each ridge starts a little after the one inside it, and the outer ones have shorter legs.
        const k = seg(drawn, i * 0.09, i * 0.09 + 0.42);
        const leg = 16 - i * 1.4;
        return (
          <path
            key={r}
            d={`M${-r} ${leg}V0A${r} ${r * 1.12} 0 0 1 ${r} 0V${leg - (i % 2) * 5}`}
            pathLength={1}
            fill="none"
            style={{ stroke: 'var(--red)' }}
            strokeWidth={1.25}
            strokeLinecap="round"
            strokeDasharray={1}
            strokeDashoffset={1 - k}
          />
        );
      })}
    </svg>
  );
}
