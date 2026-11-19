import { useEffect, useState } from 'react';
import type { UserKindFile } from '../../../engine/agents/user/native';
import { errorMessage } from '../../../engine/errors/message';
import { useAgentsStore } from '../../../state/agents';
import { useAppStore } from '../../../state/app';
import { copyKind, deleteKind, shareKind } from '../../../state/flows/userKinds';
import { useKindsStore } from '../../../state/kinds';
import ActionDeck from '../../common/actions/ActionDeck';
import type { CardMenuItem } from '../../common/CardMenu';
import ConfirmDialog from '../../common/ConfirmDialog';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import { inUseText } from '../logic/customAgentText';
import Note from '../parts/Note';
import type { KindItem } from './list/item';
import KindRows from './list/KindRows';


// The agent kinds the user added, each a row of one figure key
// (list/KindRows.tsx): its mascot, the agents made from it, or why it does
// not load. Tap to edit; ⋮ copies or shares its JSON, or
// deletes it (not while an agent is of it). Add one, or import one.
export default function CustomAgentList() {
  const push = useAppStore((s) => s.push);
  const kinds = useKindsStore((s) => s.userKinds);
  const agents = useAgentsStore((s) => s.agents);
  const [doomed, setDoomed] = useState<UserKindFile | null>(null);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    useKindsStore.getState().readUserKinds();
  }, []);

  const labelOf = (k: UserKindFile) => k.label ?? k.id;
  const edit = (k: UserKindFile) => push({ name: 'custom-agent', kindId: k.id });

  const copy = (k: UserKindFile) => {
    const copied = copyKind(k.id);
    setNote(copied ? { text: `${labelOf(k)} is on the clipboard.`, error: false } : { text: "Couldn't copy it.", error: true });
  };

  const share = (k: UserKindFile) => {
    setNote(null);
    shareKind(k.id, labelOf(k)).catch((e: unknown) => setNote({ text: errorMessage(e), error: true }));
  };

  const remove = () => {
    const k = doomed;
    setDoomed(null);
    if (!k) return;
    try {
      const gone = deleteKind(k.id);
      setNote(gone.ok ? { text: `${labelOf(k)} is deleted.`, error: false } : { text: inUseText(labelOf(k), gone.usedBy), error: true });
    } catch (e) {
      setNote({ text: errorMessage(e), error: true });
    }
  };

  const menuOf = (k: UserKindFile): CardMenuItem[] => [
    ...(k.problem ? [] : [{ label: 'Edit', onSelect: () => edit(k) }]),
    { label: 'Copy JSON', onSelect: () => copy(k) },
    { label: 'Share', onSelect: () => share(k) },
    { label: 'Delete', danger: true, onSelect: () => setDoomed(k) },
  ];

  const items: KindItem[] = kinds.map((k) => ({
    kind: k,
    label: labelOf(k),
    agents: agents.filter((a) => a.kind === k.id).length,
    menu: menuOf(k),
    onEdit: k.problem ? null : () => edit(k),
  }));

  return (
    <Screen>
      <PageHeader kicker="agents of your own" title="Custom agents" />
      <Note>
        Agents you describe yourself: any terminal UI, installed by your own script into each machine made with it.
      </Note>
      {items.length > 0 ? <KindRows items={items} /> : null}
      {kinds.length === 0 ? <Note>None yet.</Note> : null}
      {note ? <Note tone={note.error ? 'error' : 'muted'}>{note.text}</Note> : null}
      <ActionDeck
        barcode="deckCustomKinds"
        actions={[
          { label: 'Add your own agent', role: 'go', onPress: () => push({ name: 'custom-agent', kindId: null }) },
          { label: 'Import', onPress: () => push({ name: 'custom-agent-import' }) },
        ]}
      />
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
