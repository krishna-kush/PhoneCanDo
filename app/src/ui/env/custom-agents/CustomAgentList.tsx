import { useEffect, useState } from 'react';
import type { UserKindFile } from '../../../engine/agents/user/native';
import { useAgentsStore } from '../../../state/agents';
import { copyKind, deleteKind, shareKind } from '../../../state/flows/userKinds';
import { useKindsStore } from '../../../state/kinds';
import AppButton from '../../common/AppButton';
import AppCard, { type CardMenuItem } from '../../common/AppCard';
import ConfirmDialog from '../../common/ConfirmDialog';
import Screen from '../../common/Screen';
import { inUseText, kindLine } from '../logic/customAgentText';
import { useEnvNav } from '../nav';
import Note from '../parts/Note';
import PageHeader from '../parts/PageHeader';

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// The agent kinds the user added: each with the agents made from it, or
// why it does not load. Tap to edit; ⋮ copies or shares its JSON, or
// deletes it (not while an agent is of it). Add one, or import one.
export default function CustomAgentList() {
  const open = useEnvNav((s) => s.open);
  const back = useEnvNav((s) => s.back);
  const kinds = useKindsStore((s) => s.userKinds);
  const agents = useAgentsStore((s) => s.agents);
  const [doomed, setDoomed] = useState<UserKindFile | null>(null);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    useKindsStore.getState().readUserKinds();
  }, []);

  const labelOf = (k: UserKindFile) => k.label ?? k.id;
  const edit = (k: UserKindFile) => open({ name: 'custom-agent', kindId: k.id, target: null });

  const copy = (k: UserKindFile) => {
    const copied = copyKind(k.id);
    setNote(copied ? { text: `${labelOf(k)} is on the clipboard.`, error: false } : { text: "Couldn't copy it.", error: true });
  };

  const share = (k: UserKindFile) => {
    setNote(null);
    shareKind(k.id, labelOf(k)).catch((e: unknown) => setNote({ text: errorText(e), error: true }));
  };

  const remove = () => {
    const k = doomed;
    setDoomed(null);
    if (!k) return;
    try {
      const gone = deleteKind(k.id);
      setNote(gone.ok ? { text: `${labelOf(k)} is deleted.`, error: false } : { text: inUseText(labelOf(k), gone.usedBy), error: true });
    } catch (e) {
      setNote({ text: errorText(e), error: true });
    }
  };

  const menuOf = (k: UserKindFile): CardMenuItem[] => [
    ...(k.problem ? [] : [{ label: 'Edit', onSelect: () => edit(k) }]),
    { label: 'Copy JSON', onSelect: () => copy(k) },
    { label: 'Share', onSelect: () => share(k) },
    { label: 'Delete', danger: true, onSelect: () => setDoomed(k) },
  ];

  return (
    <Screen>
      <PageHeader title="Custom agents" onBack={back} />
      <Note>
        Agents you describe yourself: any terminal UI, installed by your own script into each machine made with it.
      </Note>
      {kinds.map((k) => (
        <AppCard
          key={k.id}
          title={labelOf(k)}
          subtitle={kindLine(k.id, k.problem?.detail ?? null, agents.filter((a) => a.kind === k.id).length)}
          onPress={k.problem ? undefined : () => edit(k)}
          menu={menuOf(k)}
          menuLabel={`Actions for ${labelOf(k)}`}
        />
      ))}
      {kinds.length === 0 ? <Note>None yet.</Note> : null}
      {note ? <Note tone={note.error ? 'error' : 'muted'}>{note.text}</Note> : null}
      <AppButton onPress={() => open({ name: 'custom-agent', kindId: null, target: null })}>Add your own agent</AppButton>
      <AppButton variant="secondary" onPress={() => open({ name: 'custom-agent-import' })}>
        Import
      </AppButton>
      <Note>To use one, make a new agent in an env and pick it.</Note>
      <ConfirmDialog
        open={doomed != null}
        onClose={() => setDoomed(null)}
        title={`Delete ${doomed ? labelOf(doomed) : ''}?`}
        message="It leaves the list of agents you can make. While an agent is made from it, it stays."
        onConfirm={remove}
      />
    </Screen>
  );
}
