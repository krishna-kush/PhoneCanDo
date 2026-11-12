import { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import { imageSize } from '../../../engine/linux/native';
import { useAgentsStore } from '../../../state/agents';
import { deleteAgents, stopAgents } from '../../../state/flows/agentsInBulk';
import AppButton from '../../common/AppButton';
import ConfirmDialog from '../../common/ConfirmDialog';
import PlainText from '../../common/PlainText';
import { linuxFailureText } from '../../env/logic/errorText';
import Note from '../../env/parts/Note';
import { canStop, deleteMessage, deleteTitle, failedLine, type Picked, pickedLine } from './logic/selection';
import TextAction from './TextAction';

type Props = {
  picked: Picked;
  /** Every agent is picked: the toggle offers None. */
  all: boolean;
  onToggleAll: () => void;
  onEnd: () => void;
};

// Pinned under the drawer's list while it selects: how many are picked,
// All or None, Cancel, then Stop (the running ones among them) and Delete
// (each with its machine, after a confirm that measures what comes back).
// A finished action ends the selection; a failed delete keeps the ones
// left picked and says why.
export default function SelectBar({ picked, all, onToggleAll, onEnd }: Props) {
  const agents = useAgentsStore((s) => s.agents);
  const statuses = useAgentsStore((s) => s.statuses);
  const [busy, setBusy] = useState<'stop' | 'delete' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [bytes, setBytes] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chosen = agents.filter((a) => picked.includes(a.id));
  const running = chosen.filter((a) => canStop(statuses[a.id]?.state));
  const names = chosen.map((a) => a.name);

  const stop = () => {
    setBusy('stop');
    setError(null);
    void stopAgents(running.map((a) => a.id)).finally(() => {
      setBusy(null);
      onEnd();
    });
  };

  const ask = () => {
    setConfirm(true);
    setBytes(null);
    void Promise.all(chosen.map((a) => imageSize(a.imageId).catch(() => 0))).then((sizes) =>
      setBytes(sizes.reduce((sum, b) => sum + b, 0)),
    );
  };

  const remove = () => {
    setConfirm(false);
    setBusy('delete');
    setError(null);
    void deleteAgents(chosen.map((a) => a.id)).then((failed) => {
      setBusy(null);
      if (failed.length === 0) onEnd();
      else setError(failedLine(failed.map((f) => ({ name: f.name, reason: linuxFailureText(f.error) }))));
    });
  };

  return (
    <YStack borderTopWidth={1} borderColor="lineStrong" backgroundColor="panel" padding={16} gap="3">
      <XStack alignItems="center" justifyContent="space-between" gap="4">
        <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.4} color="dim" textTransform="uppercase">
          {pickedLine(chosen.length)}
        </PlainText>
        <XStack gap="5">
          <TextAction label={all ? 'None' : 'All'} onPress={onToggleAll} />
          <TextAction label="Cancel" onPress={onEnd} />
        </XStack>
      </XStack>
      {error ? <Note tone="error">{error}</Note> : null}
      <XStack gap="2">
        <AppButton
          variant="secondary"
          flex={1}
          loading={busy === 'stop'}
          disabled={running.length === 0 || busy != null}
          onPress={stop}
        >
          Stop
        </AppButton>
        <AppButton
          variant="danger"
          flex={1}
          loading={busy === 'delete'}
          disabled={chosen.length === 0 || busy != null}
          onPress={ask}
        >
          Delete
        </AppButton>
      </XStack>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={deleteTitle(names)}
        message={deleteMessage(names, bytes, chosen.length === agents.length)}
        onConfirm={remove}
      />
    </YStack>
  );
}
