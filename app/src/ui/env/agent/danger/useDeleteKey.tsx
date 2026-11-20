import { type ReactNode, useState } from 'react';
import type { Agent } from '../../../../engine/agents/records';
import { imageSize } from '../../../../engine/linux/native';
import type { Image } from '../../../../engine/linux/types';
import { useAgentsStore } from '../../../../state/agents';
import { useAppStore } from '../../../../state/app';
import { deleteAgentAndImage } from '../../../../state/flows/deleteAgentAndImage';
import type { DeckAction } from '../../../common/actions/types';
import ConfirmDialog from '../../../common/ConfirmDialog';
import { linuxFailureText } from '../../logic/errorText';
import { formatBytes } from '../../logic/format';
import { deleteSharedMessage } from '../../logic/sharedMachineText';
import Note from '../../parts/Note';
import { useMachineMates } from '../useMachineMates';

type Size = { kind: 'measuring' } | { kind: 'known'; bytes: number } | { kind: 'unknown' };

// Delete: the agent and its machine, for good. The confirm measures the
// machine first, so it says how much space comes back. A machine other
// agents use stays: the confirm names them, and says whether its sign-in
// and chats go with it (a folder of its own) or stay in the machine.
// Its key goes in the danger deck; `below` is what shows under the deck.
export function useDeleteKey(agent: Agent, image: Image | undefined): { action: DeckAction; below: ReactNode } {
  const leaveAgent = useAppStore((s) => s.leaveAgent);
  const onlyAgent = useAgentsStore((s) => s.agents.length === 1);
  const mates = useMachineMates(agent);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState<Size>({ kind: 'unknown' });
  const [error, setError] = useState<string | null>(null);
  const shared = mates.length > 0;

  const ask = () => {
    setConfirm(true);
    if (!image || shared) return;
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
      .then(() => leaveAgent(agent.id))
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
  const message = shared
    ? deleteSharedMessage(mates.map((a) => a.name))
    : `This deletes the agent and its machine with everything in it: projects, chats, keys and installed tools.${sizeLine}${lastLine}`;

  return {
    action: { label: 'Delete agent', role: 'danger', loading: busy, onPress: ask },
    below: (
      <>
        {error ? <Note tone="error">{error}</Note> : null}
        <ConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          title={`Delete ${agent.name}?`}
          message={message}
          agentIds={[agent.id]}
          onConfirm={remove}
        />
      </>
    ),
  };
}
