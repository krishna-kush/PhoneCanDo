import Svg, { Path } from 'react-native-svg';
import { pathOf } from '../../../../../mascot/layout/path.ts';
import type { Color, Drawn } from '../../../../../mascot/layout/types.ts';
import tokens from '../../../../../theme/tokens.json';
import { useTheme } from '../globals';

type Props = {
  marks: readonly Drawn[];
  /** The box it is drawn in, and where the figure's feet are in it. */
  box: number;
  dx: number;
  dy: number;
};

// What a face wears, over its blocks and eyes: the marks the shared spec
// laid out (mascot/layout/), in the theme's inks: the hats in the text's
// colour, ties and frames in the screens' dark, as the pupils are.
export default function WearMarks({ marks, box, dx, dy }: Props) {
  const t = useTheme();
  if (!marks.length) return null;
  const ink = (c: Color) =>
    c === 'wear' ? t.fg : c === 'red' ? t.primary : c === 'amber' ? t.secondary : c === 'eye' ? t.onPrimary : tokens.dark.bg;
  return (
    <Svg
      width={box}
      height={box}
      viewBox={`${-dx} ${-dy} ${box} ${box}`}
      style={{ position: 'absolute', left: 0, top: 0 }}
      pointerEvents="none"
    >
      {marks.map((m, i) => (
        <Path
          key={i}
          d={pathOf(m)}
          fill={m.fill ? ink(m.fill) : 'none'}
          stroke={m.stroke ? ink(m.stroke) : undefined}
          strokeWidth={m.stroke ? Math.max(1, m.width) : undefined}
          opacity={m.alpha}
        />
      ))}
    </Svg>
  );
}
