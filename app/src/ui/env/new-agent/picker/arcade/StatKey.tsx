import { XStack, YStack } from 'tamagui';
import PlainText from '../../../../common/PlainText';
import RowFrame from '../../../../common/rows/RowFrame';
import RowGroup from '../../../../common/rows/RowGroup';
import { type KeyMark, STAT_KEY, statKey } from '../logic/statKey';
import Coin from './Coin';
import Meter from './Meter';
import Term from './Term';

/** The marks' column, in dp: room for a meter, a coin or a move's input. */
const MARK_W = 56;

// At the foot of the Choose agent step, the key to the showcase's stats
// (logic/statKey.ts), as a game's manual explains its stat screen: a
// section each for cost, fans, messages and schedules, every level with
// its coin or meter, its words and what it means, then what a power move
// is.
export default function StatKey() {
  const sections = statKey();
  return (
    <RowGroup title={STAT_KEY} barcode="arcadeKey">
      {sections.map((s) => (
        <RowFrame key={s.term}>
          <YStack gap={10}>
            <Term wide>{s.term}</Term>
            {s.rows.map((r) => (
              <XStack key={r.value || s.term} gap="3" alignItems="flex-start">
                <YStack width={MARK_W}>
                  <Mark mark={r.mark} />
                </YStack>
                <YStack flex={1} minWidth={0} gap={2}>
                  {r.value ? (
                    <PlainText fontFamily="mono" fontSize={13}>
                      {r.value}
                    </PlainText>
                  ) : null}
                  {r.meaning ? (
                    <PlainText fontSize={13} color="muted">
                      {r.meaning}
                    </PlainText>
                  ) : null}
                </YStack>
              </XStack>
            ))}
            {s.note ? (
              <PlainText fontSize={12} color="dim">
                {s.note}
              </PlainText>
            ) : null}
          </YStack>
        </RowFrame>
      ))}
    </RowGroup>
  );
}

// A level's mark, lined up with its words' first line: its coin, its meter
// (filled once, as the key comes up) or a move's input in amber.
function Mark({ mark }: { mark: KeyMark }) {
  if ('coin' in mark) {
    return (
      <YStack paddingTop={3}>
        <Coin coin={mark.coin} size={11} />
      </YStack>
    );
  }
  if ('meter' in mark) {
    return (
      <YStack paddingTop={6}>
        <Meter value={mark.meter} replay="key" />
      </YStack>
    );
  }
  return (
    <PlainText fontFamily="mono" fontSize={13} fontWeight="700" color="secondaryInk" letterSpacing={1}>
      {mark.input}
    </PlainText>
  );
}
