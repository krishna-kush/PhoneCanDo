import { XStack, YStack } from 'tamagui';
import PlainText from '../../../../common/PlainText';
import type { Fact } from '../logic/facts';
import Meter, { METER_W } from './Meter';

/** The terms' column, in dp, so the rows keep one edge. */
const TERM_W = 92;

type Props = {
  facts: readonly Fact[];
  /** The applicant they are about: the meters fill again when it changes. */
  replay: string;
};

// The showcase's stats (logic/facts.ts), a printed line each: the term in
// faint mono capitals, its meter (none for a plain fact, its room kept),
// then its words, faint for a fact it lacks.
export default function FactRows({ facts, replay }: Props) {
  return (
    <YStack gap={6}>
      {facts.map((f) => (
        <XStack key={f.term} alignItems="center" gap="3">
          <PlainText
            fontFamily="mono"
            fontSize={10}
            fontWeight="500"
            letterSpacing={1.2}
            textTransform="uppercase"
            color="faint"
            width={TERM_W}
          >
            {f.term}
          </PlainText>
          {f.meter == null ? <YStack width={METER_W} /> : <Meter value={f.meter} replay={replay} />}
          <PlainText fontFamily="mono" fontSize={13} color={f.meter === 0 ? 'faint' : 'fg'} flex={1} numberOfLines={1}>
            {f.value}
          </PlainText>
        </XStack>
      ))}
    </YStack>
  );
}
