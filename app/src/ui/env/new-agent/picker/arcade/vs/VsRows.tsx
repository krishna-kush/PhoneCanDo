import { XStack, YStack } from 'tamagui';
import ArrowIcon from '../../../../../common/ArrowIcon';
import { useTheme } from '../../../../../common/globals';
import PlainText from '../../../../../common/PlainText';
import { type VsCell, type VsRow, vsRowLabel, type VsWinner } from '../../logic/vs';
import Coin from '../Coin';
import Meter from '../Meter';

/** The terms' column down the middle, in dp. */
const TERM_W = 78;

type Props = {
  rows: readonly VsRow[];
  /** The two names, for what a screen reader hears. */
  names: readonly [string, string];
  /** The match up: meters fill and coins spin again when it changes. */
  replay: string;
};

// The VS plate's stats, a row each: the pick's side, the term down the
// middle with a pointer at whoever takes it (= when even), the
// challenger's side. Each side's
// meter faces out from the middle; the winner's words are amber, the
// loser's faint.
export default function VsRows({ rows, names, replay }: Props) {
  const t = useTheme();
  return (
    <YStack gap={12}>
      {rows.map((r) => (
        <XStack key={r.term} alignItems="flex-start" gap="2" accessible accessibilityLabel={vsRowLabel(r, names[0], names[1])}>
          <Side cell={r.left} left tone={tone(r.winner, 'left')} replay={replay} />
          <YStack width={TERM_W} alignItems="center" gap={4}>
            <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.2} textTransform="uppercase" color="faint" textAlign="center">
              {r.term}
            </PlainText>
            {r.winner === 'left' || r.winner === 'right' ? (
              <ArrowIcon dir={r.winner} size={9} color={t.secondaryInk} />
            ) : r.winner === 'tie' ? (
              <PlainText fontFamily="mono" fontSize={11} color="faint">
                =
              </PlainText>
            ) : null}
          </YStack>
          <Side cell={r.right} left={false} tone={tone(r.winner, 'right')} replay={replay} />
        </XStack>
      ))}
    </YStack>
  );
}

type Tone = 'secondaryInk' | 'faint' | 'fg';

const tone = (winner: VsWinner, side: 'left' | 'right'): Tone =>
  winner === side ? 'secondaryInk' : winner === 'left' || winner === 'right' ? 'faint' : 'fg';

// One side of a row, against its own edge: its coin or meter, then its words.
function Side({ cell, left, tone, replay }: { cell: VsCell; left: boolean; tone: Tone; replay: string }) {
  return (
    <YStack flex={1} minWidth={0} gap={4} alignItems={left ? 'flex-end' : 'flex-start'}>
      {cell.coin ? (
        <Coin coin={cell.coin} size={11} spin={replay} />
      ) : cell.meter != null ? (
        <Meter value={cell.meter} replay={replay} mirror={left} />
      ) : null}
      <PlainText fontFamily="mono" fontSize={12} color={tone} textAlign={left ? 'right' : undefined} numberOfLines={2}>
        {cell.value}
      </PlainText>
    </YStack>
  );
}
