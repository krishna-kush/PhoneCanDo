import { useEffect, useRef, useState } from 'react';
import { XStack, YStack } from 'tamagui';
import FieldLine from '../../../common/FieldLine';
import AgentFace from '../../../common/face/AgentFace';
import PlainText from '../../../common/PlainText';
import Plate from '../../../common/Plate';
import KeyHead from '../../../common/rows/KeyHead';
import { ROW_GUTTER } from '../../../common/rows/place';
import Stamp from '../../../common/Stamp';
import { usePageActive } from '../../../nav/pageActive';
import { badgeKicker, type BadgeLine, type BadgeMode, type BadgeMood, type BadgeNeed } from '../logic/badge';
import { kindLook } from '../logic/kindLook';
import BadgeTicks from './BadgeTicks';

type Props = {
  mode: BadgeMode;
  name: string;
  /** The id its mascot is picked by (logic/badge.ts badgeId), so its face is the one the list shows. */
  lookId: string;
  lines: readonly BadgeLine[];
  mood: BadgeMood;
  /** What it needs, ticked off: on the form. Absent on a review step, which lands its stamp instead. */
  needs?: readonly BadgeNeed[];
  stamp?: string;
};

// The new agent taking shape over its form, as a crew badge from the
// site's floor: the key strip ("Crew badge · new hire"), its face (its own
// mascot, asleep until something is filled in, looking about while it
// fills, awake once all it needs is in, hopping each time one more is),
// its name tag, id and a line each for how it installs, starts and what
// tools it gets; then the needs ticked off, or on review the stamp, slammed
// on with the face floating hearts. It stands on the hard amber shadow.
export default function HireBadge({ mode, name, lookId, lines, mood, needs, stamp }: Props) {
  const active = usePageActive();
  const hop = useHopOnMore(needs);
  const shown = name.trim();
  return (
    <Plate>
      <KeyHead title={badgeKicker(mode)} barcode="hireBadge" />
      <XStack gap="3" paddingHorizontal={ROW_GUTTER} paddingVertical="3" alignItems="flex-start">
        <YStack width={52} height={52} alignItems="center" justifyContent="center" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <AgentFace mood={mood} size={34} mascot={kindLook(lookId)} hop={hop} still={!active} hearts={2} />
        </YStack>
        <YStack flex={1} minWidth={0} gap={3}>
          <PlainText fontSize={20} fontWeight="700" letterSpacing={-0.3} numberOfLines={1} color={shown ? 'fg' : 'faint'}>
            {shown || 'Your agent'}
          </PlainText>
          <PlainText fontFamily="mono" fontSize={11} color="dim" numberOfLines={1}>
            {lookId}
          </PlainText>
          <YStack gap={3} paddingTop="1">
            {lines.map((l) => (
              <FieldLine key={l.term} term={l.term} value={l.value} termWidth={62} tone="muted" />
            ))}
          </YStack>
        </YStack>
      </XStack>
      {needs ? <BadgeTicks needs={needs} /> : null}
      {stamp ? (
        <XStack justifyContent="flex-end" paddingHorizontal={ROW_GUTTER} paddingBottom="3">
          <Stamp slam>{stamp}</Stamp>
        </XStack>
      ) : null}
    </Plate>
  );
}

// A hop each time one more need is ticked.
function useHopOnMore(needs: readonly BadgeNeed[] | undefined): number {
  const done = needs?.filter((n) => n.done).length ?? 0;
  const last = useRef(done);
  const [hop, setHop] = useState(0);
  useEffect(() => {
    if (done > last.current) setHop((h) => h + 1);
    last.current = done;
  }, [done]);
  return hop;
}
