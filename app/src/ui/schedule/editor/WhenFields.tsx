import { YStack } from 'tamagui';
import { pickAvailable } from '../../../engine/pick';
import type { Timing } from '../../../engine/schedule/types';
import Note from '../../env/parts/Note';
import { type Draft, withWhen } from '../logic/draft';
import DailyFields from './when/DailyFields';
import EveryFields from './when/EveryFields';
import KindSwitch from './when/KindSwitch';
import OnceFields from './when/OnceFields';

type Props = {
  draft: Draft;
  onChange: (d: Draft) => void;
  now: number;
  /** The timing the form says (nextRuns.boardTiming), for the interval's ruler. */
  timing: Timing | null;
  /** What is wrong with the time or the interval (shown under it). */
  problems: readonly string[];
};

// When it runs, mostly by tapping: a lever for once, every so often or
// daily, then that one's fields (when/): a day and a time on split-flap
// tiles, an interval with its day of runs on a ruler, or a time on the
// days picked from a week's strip.
export default function WhenFields({ draft, onChange, now, timing, problems }: Props) {
  const dialogs = pickAvailable();
  return (
    <YStack gap="3">
      <KindSwitch value={draft.when} onPick={(w) => onChange(withWhen(draft, w))} />
      {draft.when === 'once' ? <OnceFields draft={draft} onChange={onChange} now={now} dialogs={dialogs} /> : null}
      {draft.when === 'every' ? <EveryFields draft={draft} onChange={onChange} now={now} timing={timing} /> : null}
      {draft.when === 'daily' ? <DailyFields draft={draft} onChange={onChange} dialogs={dialogs} /> : null}
      {problems.map((p) => (
        <Note key={p} tone="error">
          {p}
        </Note>
      ))}
    </YStack>
  );
}
