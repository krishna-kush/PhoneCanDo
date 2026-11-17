import { useEffect, useState } from 'react';
import { XStack, YStack } from 'tamagui';
import PlainText from '../../../../common/PlainText';
import { useReduceMotion } from '../../../../common/useReduceMotion';
import { POWER_MOVE, POWER_MOVE_HINT } from '../copy';
import Term from './Term';

/** How long each typed character takes to come up. */
const STEP_MS = 60;

type Props = {
  keys: string;
  does: string;
  /** The applicant it belongs to: it is typed out again when it changes. */
  replay: string;
};

// The picked applicant's power move, as a move list prints one: what to
// type in its own app, typed out in amber a character at a time behind a
// prompt as the applicant steps up (all at once with reduce motion), then
// what it does.
export default function PowerMove({ keys, does, replay }: Props) {
  const typed = useTyped(keys, replay);
  return (
    <YStack gap={6} accessible accessibilityLabel={`${POWER_MOVE}: type ${keys}. ${does}. ${POWER_MOVE_HINT}`}>
      <XStack alignItems="center" gap="3">
        <Term>{POWER_MOVE}</Term>
        <XStack flex={1} minWidth={0} alignItems="center" gap={6}>
          <PlainText fontFamily="mono" fontSize={14} color="faint">
            ›
          </PlainText>
          <PlainText fontFamily="mono" fontSize={14} fontWeight="700" color="secondaryInk" numberOfLines={1} flexShrink={1}>
            {typed}
          </PlainText>
        </XStack>
      </XStack>
      <PlainText fontSize={15} fontWeight="500">
        {does}
      </PlainText>
      <PlainText fontSize={12} color="dim">
        {POWER_MOVE_HINT}
      </PlainText>
    </YStack>
  );
}

// [text] so far: from none, a character more each step until all of it
// shows, each time [replay] changes; all of it with reduce motion.
function useTyped(text: string, replay: string): string {
  const reduce = useReduceMotion();
  const chars = [...text];
  const [count, setCount] = useState(reduce ? chars.length : 0);
  useEffect(() => {
    if (!reduce) setCount(0);
  }, [replay, text, reduce]);
  useEffect(() => {
    if (reduce || count >= chars.length) return;
    const t = setTimeout(() => setCount((c) => c + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [count, chars.length, reduce]);
  return reduce ? text : chars.slice(0, count).join('');
}
