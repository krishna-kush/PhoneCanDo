import { YStack } from 'tamagui';
import type { MemoryCount } from '../../../engine/models/types';
import Bench from '../../common/bench/Bench';
import Place from '../../common/bench/Place';
import PlainText from '../../common/PlainText';
import SectionTitle from '../../common/SectionTitle';
import { countFilled, countNote, countOptions, countShort, type CountKind } from '../logic/memory';
import AutoStamp from './AutoStamp';
import CountToken from './tokens/CountToken';

type Props = {
  title: string;
  kind: CountKind;
  count: MemoryCount;
  /** Null: Auto. */
  value: number | null;
  /** How many the planner finds room for now (saved chats only). */
  fitsNow?: number | null;
  /** Chats go to storage instead of RAM (saved chats only). */
  onStorage?: boolean;
  disabled: boolean;
  onPick: (value: number | null) => void;
};

// One count of the Memory setting's Advanced as a bench (common/bench): Auto
// first, as a little stamp with what it picks under it, then a place per
// number the planner offers here, each labelled. On each sits what it
// counts (a chat bubble, a snapshot, a core): 1 up to the choice, or to
// Auto's, sit down, lit amber; the rest lift out, faded. A saved chat
// asked for with no room for it now is red. Then what it means and what
// Auto picks.
export default function CountPicker({ title, kind, count, value, fitsNow = null, onStorage = false, disabled, onPick }: Props) {
  const numbers = countOptions(count).filter((n): n is number => n != null);
  const state = (n: number) =>
    countShort(n, value, count, kind === 'saved' ? fitsNow : null, onStorage) ? 'short' : countFilled(n, value, count) ? 'in' : 'out';
  return (
    <YStack gap="2">
      <SectionTitle>{title}</SectionTitle>
      <Bench
        label={title}
        at={value == null ? 0 : numbers.indexOf(value) + 1}
        first={
          <Place
            label={`=${count.auto}`}
            lit={value == null}
            picked={value == null}
            disabled={disabled}
            onPress={() => onPick(null)}
            a11y={`Auto, ${count.auto}`}
          >
            <AutoStamp on={value == null} />
          </Place>
        }
      >
        {numbers.map((n) => (
          <Place
            key={n}
            label={String(n)}
            lit={countFilled(n, value, count) || n === value}
            picked={n === value}
            disabled={disabled}
            onPress={() => onPick(n)}
            a11y={String(n)}
          >
            {n > 0 ? <CountToken kind={kind} state={state(n)} /> : null}
          </Place>
        ))}
      </Bench>
      <PlainText fontSize={14} color="muted">
        {countNote(kind, value, count, fitsNow, onStorage)}
      </PlainText>
    </YStack>
  );
}
