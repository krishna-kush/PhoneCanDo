import Svg, { Line } from 'react-native-svg';
import { XStack, YStack } from 'tamagui';
import type { Timing } from '../../../../engine/schedule/types';
import { useTheme } from '../../../common/globals';
import PlainText from '../../../common/PlainText';
import { DAY } from '../../logic/clock';
import { perDayText, RULER_MARKS } from '../../logic/editorCopy';
import { rulerMarks } from '../../logic/nextRuns';

const HEIGHT = 22;
const QUARTERS = [0, 0.25, 0.5, 0.75, 1];

// Inside the ends, so a run at now or at +24 h shows whole.
const at = (part: number) => `${0.5 + part * 99}%`;

type Props = { timing: Timing | null; now: number; minutes: number | null };

// An interval's next day on a ruler: now at its left, a day ahead at its
// right, a mark every 6 hours, and a red stroke at each run, so a short
// interval prints a barcode and a long one a few strokes; how busy that
// keeps the agent under it ("96 runs a day").
export default function DayRuler({ timing, now, minutes }: Props) {
  const t = useTheme();
  const runs = timing ? rulerMarks(timing, now, DAY) : [];
  return (
    <YStack gap="1" accessible accessibilityLabel={minutes ? perDayText(minutes) : undefined}>
      <Svg width="100%" height={HEIGHT}>
        <Line x1="0" x2="100%" y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} stroke={t.lineStrong} strokeWidth={1} />
        {QUARTERS.map((q) => (
          <Line key={q} x1={at(q)} x2={at(q)} y1={HEIGHT - 8} y2={HEIGHT} stroke={t.lineStrong} strokeWidth={1} />
        ))}
        {runs.map((r) => (
          <Line key={r} x1={at(r)} x2={at(r)} y1={2} y2={HEIGHT - 1} stroke={t.primary} strokeWidth={1.5} />
        ))}
      </Svg>
      <XStack justifyContent="space-between">
        {RULER_MARKS.map((mark) => (
          <PlainText key={mark} fontFamily="mono" fontSize={9} color="dim">
            {mark}
          </PlainText>
        ))}
      </XStack>
      {minutes ? (
        <PlainText fontFamily="mono" fontSize={11} color="secondaryInk">
          {perDayText(minutes)}
        </PlainText>
      ) : null}
    </YStack>
  );
}
