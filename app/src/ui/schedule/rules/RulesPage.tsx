import { useMemo } from 'react';
import { allKinds } from '../../../engine/agents/registry';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import Note from '../../env/parts/Note';
import { useSlidIn } from '../../nav/slidIn';
import { RULES_INTRO, RULES_TITLE, ruleSections } from '../logic/rulesCopy';
import { SCHEDULES_TITLE } from '../logic/scheduleCopy';
import RuleRows from './RuleRows';

// How schedules run, opened from the Schedules page's foot: what a due
// task does by kind (the kinds this build has, by their flags), when it
// asks you instead, waits and misses, and what each run leaves behind.
// Read once as it opens: the rules don't change while you read them.
export default function RulesPage() {
  const slidIn = useSlidIn();
  const sections = useMemo(() => ruleSections(allKinds()), []);
  return (
    <Screen>
      <PageHeader kicker={SCHEDULES_TITLE} title={RULES_TITLE} />
      <Note>{RULES_INTRO}</Note>
      {sections.map((s) => (s.rows.length > 0 ? <RuleRows key={s.id} section={s} landed={slidIn} /> : null))}
    </Screen>
  );
}
