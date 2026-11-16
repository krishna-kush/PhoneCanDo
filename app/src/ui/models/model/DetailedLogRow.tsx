import { useState } from 'react';
import { YStack } from 'tamagui';
import type { LocalModel } from '../../../engine/models/types';
import { useAgentsStore } from '../../../state/agents';
import { chooseDetailedLog } from '../../../state/flows/modelMemory';
import SwitchRow from '../../common/rows/SwitchRow';
import { startFailureCode, startFailureText } from '../../env/logic/errorText';
import Note from '../../env/parts/Note';
import ProgressBar from '../../env/parts/ProgressBar';
import { restartNote, runningOn } from '../logic/context';
import { modelErrorText } from '../logic/errorText';
import { DETAILED_LOG_TITLE, detailedLogNote } from '../logic/detailedLog';

// A model's "Detailed log" on its Server log page, a switch row (the
// title, what it means under it, the square mark). Off by default. A change is saved on the model and
// restarts the agents running on it, so its server starts again logging
// in detail, or not: a line names them before, and a bar shows while it
// restarts.
export default function DetailedLogRow({ model }: { model: LocalModel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const agents = useAgentsStore((s) => s.agents);
  const statuses = useAgentsStore((s) => s.statuses);
  const running = runningOn(model.id, agents, statuses);
  const on = model.detailedLog;
  const toggle = async () => {
    setBusy(true);
    setError(null);
    const res = await chooseDetailedLog(model.id, !on);
    setBusy(false);
    if (!res.ok) {
      setError(modelErrorText(res.code, res.message));
      return;
    }
    const failed = res.restarts.flatMap(({ result }) => {
      const code = startFailureCode(result.status);
      return code ? [startFailureText(code, result.error)] : [];
    });
    if (failed.length > 0) setError(failed.join(' '));
  };
  return (
    <YStack gap="2">
      <SwitchRow
        title={DETAILED_LOG_TITLE}
        on={on}
        onToggle={() => void toggle()}
        note={detailedLogNote(on)}
        busy={busy}
      />
      {busy ? (
        <ProgressBar label="Restarting the model: loading it can take a minute" fraction={null} />
      ) : running.length > 0 ? (
        <Note>{restartNote(running, 'Changing it')}</Note>
      ) : null}
      {error ? <Note tone="error">{error}</Note> : null}
    </YStack>
  );
}
