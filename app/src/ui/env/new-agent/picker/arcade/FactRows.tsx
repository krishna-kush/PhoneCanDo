import { XStack, YStack } from 'tamagui';
import PlainText from '../../../../common/PlainText';
import type { Fact } from '../logic/facts';
import Coin from './Coin';
import Meter, { METER_W } from './Meter';
import Term, { TERM_W } from './Term';

/** The cost coin's size, in dp. */
const COIN = 11;

type Props = {
  facts: readonly Fact[];
  /** The applicant they are about: the meters fill again, and the coin spins, when it changes. */
  replay: string;
};

// The showcase's stats (logic/facts.ts), a printed line each: the term in
// faint mono capitals, its meter or its coin (neither for a plain fact,
// its room kept), then its words, faint for a fact it lacks; a fact's note
// goes on a line of its own under its words.
export default function FactRows({ facts, replay }: Props) {
  return (
    <YStack gap={6}>
      {facts.map((f) => (
        <YStack key={f.term} gap={2}>
          <XStack alignItems="center" gap="3">
            <Term>{f.term}</Term>
            {f.coin ? (
              <YStack width={METER_W}>
                <Coin coin={f.coin} size={COIN} spin={replay} />
              </YStack>
            ) : f.meter == null ? (
              <YStack width={METER_W} />
            ) : (
              <Meter value={f.meter} replay={replay} />
            )}
            <PlainText
              fontFamily="mono"
              fontSize={13}
              color={f.meter === 0 ? 'faint' : f.coin && f.coin !== 'slot' ? 'secondaryInk' : 'fg'}
              flex={1}
              numberOfLines={1}
            >
              {f.value}
            </PlainText>
          </XStack>
          {f.note ? (
            <XStack gap="3">
              <YStack width={TERM_W} />
              <YStack width={METER_W} />
              <PlainText fontSize={12} color="muted" flex={1}>
                {f.note}
              </PlainText>
            </XStack>
          ) : null}
        </YStack>
      ))}
    </YStack>
  );
}
