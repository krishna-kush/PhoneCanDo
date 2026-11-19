import { useState } from 'react';
import { allowsAll, canAllowAll, setAllowsAll } from '../../../engine/acp/native';
import SwitchRow from '../../common/rows/SwitchRow';
import { ALLOW_ALL_TITLE, allowAllNote } from '../../chat/background/logic/copy';

// The agent's "Allow everything" in its Settings group, a switch row: off
// (the default), it asks you before each step of a background run; on
// (also from its question's Allow everything key), the runner allows
// every step itself. Kept natively, so it holds with no JS around. A
// build that cannot keep it shows no row.
export default function AllowAllRow({ agentId }: { agentId: string }) {
  const [on, setOn] = useState(() => allowsAll(agentId));
  const [failed, setFailed] = useState(false);
  if (!canAllowAll()) return null;
  const toggle = () => {
    const kept = setAllowsAll(agentId, !on);
    setFailed(kept == null);
    if (kept != null) setOn(kept);
  };
  return (
    <SwitchRow
      title={ALLOW_ALL_TITLE}
      on={on}
      onToggle={toggle}
      note={failed ? "Couldn't save it." : allowAllNote(on)}
      alert={failed}
      hint={allowAllNote(on)}
    />
  );
}
