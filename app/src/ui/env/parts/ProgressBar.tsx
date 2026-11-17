import { XStack, YStack } from 'tamagui';
import LogoLoader from '../../common/LogoLoader';
import PlainText from '../../common/PlainText';
import Route from '../../common/route/Route';
import HazardTape from './HazardTape';

type Props = {
  label: string;
  fraction: number | null;
  /** A download's source (Hugging Face, Docker Hub): its bytes as a parcel run (common/route) over the line. */
  from?: string;
  /** A download paused part way, or waiting to try again or for a network: A-01 naps on the road. */
  paused?: boolean;
  /** A download starting or re-reading what it has: A-01 hops where it stands. */
  working?: boolean;
};

// A job's line: its step in words over a thin bar, or the small logo loader
// over a crawl of hazard tape while the total is unknown. Square and
// hairline like the rest. The bar is drawn to a tenth of a percent, so a
// slow one still creeps. A download is A-01 carrying its parcel from
// [from] to this phone instead, its line under the road, from start to
// end: while its size is unknown or it settles, A-01 keeps its spot.
export default function ProgressBar({ label, fraction, from, paused = false, working = false }: Props) {
  const percent = fraction == null ? 0 : Math.round(Math.min(1, Math.max(0, fraction)) * 1000) / 10;
  if (from) {
    return (
      <YStack gap="1" accessibilityRole="progressbar" accessibilityValue={fraction == null ? undefined : { min: 0, max: 100, now: Math.round(percent) }}>
        <Route stage={paused ? 'paused' : 'moving'} fraction={fraction} working={working} from={from} compact />
        <PlainText fontFamily="mono" fontSize={12} color="dim" numberOfLines={1}>
          {label}
        </PlainText>
      </YStack>
    );
  }
  return (
    <YStack gap="2">
      <XStack alignItems="center" gap="2">
        {fraction == null ? <LogoLoader size={8} /> : null}
        <PlainText fontFamily="mono" fontSize={12} color="dim" numberOfLines={1} flexShrink={1}>
          {label}
        </PlainText>
      </XStack>
      {fraction == null ? (
        <HazardTape />
      ) : (
        <YStack
          height={4}
          backgroundColor="line"
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
        >
          <YStack height={4} width={`${percent}%`} backgroundColor="primary" />
        </YStack>
      )}
    </YStack>
  );
}
