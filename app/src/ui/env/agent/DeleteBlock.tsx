import { useState } from 'react';
import type { Agent } from '../../../engine/agents/records';
import { imageSize } from '../../../engine/linux/native';
import type { Image } from '../../../engine/linux/types';
import { useAgentsStore } from '../../../state/agents';
import { deleteAgentAndImage } from '../../../state/flows/deleteAgentAndImage';
import AppButton from '../../common/AppButton';
import ConfirmDialog from '../../common/ConfirmDialog';
import { linuxFailureText } from '../logic/errorText';
import { formatBytes } from '../logic/format';
import { useEnvNav } from '../nav';
import Note from '../parts/Note';

type Size = { kind: 'measuring' } | { kind: 'known'; bytes: number } | { kind: 'unknown' };

// Delete: the agent and its machine, for good. The confirm measures the
// machine first, so it says how much space comes back.
export default function DeleteBlock({ agent, image }: { agent: Agent; image: Image | undefined }) {
  const open = useEnvNav((s) => s.open);
  const onlyAgent = useAgentsStore((s) => s.agents.length === 1);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState<Size>({ kind: 'unknown' });
  const [error, setError] = useState<string | null>(null);

  const ask = () => {
    setConfirm(true);
    if (!image) return;
    setSize({ kind: 'measuring' });
    imageSize(image.id)
      .then((bytes) => setSize(bytes > 0 ? { kind: 'known', bytes } : { kind: 'unknown' }))
      .catch(() => setSize({ kind: 'unknown' }));
  };

  const remove = () => {
    setConfirm(false);
    setBusy(true);
    setError(null);
    deleteAgentAndImage(agent.id)
      .then(() => open({ name: 'list' }))
      .catch((e: unknown) => setError(linuxFailureText(e)))
      .finally(() => setBusy(false));
  };

  const sizeLine =
    size.kind === 'measuring'
      ? ' Measuring its size…'
      : size.kind === 'known'
        ? ` That frees about ${formatBytes(size.bytes)}.`
        : '';
  const lastLine = onlyAgent ? " It's your only agent, so we'll set up a fresh one right after." : '';

  return (
    <>
      <AppButton variant="danger" loading={busy} onPress={ask}>
        Delete agent
      </AppButton>
      {error ? <Note tone="error">{error}</Note> : null}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete ${agent.name}?`}
        message={`This deletes the agent and its machine with everything in it: projects, chats, keys and installed tools.${sizeLine}${lastLine}`}
        onConfirm={remove}
      />
    </>
  );
}
