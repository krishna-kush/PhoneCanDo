import { useAppStore } from '../../../state/app';
import LinkRow from '../../common/LinkRow';
import RowGroup from '../../common/rows/RowGroup';
import { RULES_ENTRY_BOX, RULES_ENTRY_NOTE, RULES_TITLE } from '../logic/rulesCopy';

// The Schedules page's last box: one row that opens "How schedules run",
// there when you want it and out of the way under everything else.
export default function RulesEntry() {
  const push = useAppStore((s) => s.push);
  return (
    <RowGroup title={RULES_ENTRY_BOX} barcode="schedulesRules">
      <LinkRow label={RULES_TITLE} note={RULES_ENTRY_NOTE} onPress={() => push({ name: 'schedule-rules' })} />
    </RowGroup>
  );
}
