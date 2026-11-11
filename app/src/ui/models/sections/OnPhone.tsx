import { useState } from 'react';
import { XStack } from 'tamagui';
import type { LocalModel } from '../../../engine/models/types';
import { importFromPhone, remove } from '../../../state/flows/modelActions';
import { useModelsStore } from '../../../state/models';
import AppButton from '../../common/AppButton';
import ConfirmDialog from '../../common/ConfirmDialog';
import SectionTitle from '../../common/SectionTitle';
import { formatBytes } from '../../env/logic/format';
import Note from '../../env/parts/Note';
import { useSlidInList } from '../../nav/slidIn';
import ContextSetting from '../context/ContextSetting';
import { canChoose, contextButtonText, reducedLine } from '../logic/context';
import { modelLine, sourceText } from '../logic/modelText';
import ModelPanel from '../parts/ModelPanel';
import { useAction } from '../useAction';

// The models on the phone, each with its verdict, a line when we serve it
// with less context than it was trained for, its Context setting and Delete
// (refused while an agent is set to it), and Import: a GGUF file from the
// phone's storage. `firstScreen` panels draw as the page opens (ModelsPage.tsx).
export default function OnPhone({ firstScreen }: { firstScreen: number }) {
  const models = useModelsStore((s) => s.models);
  const shown = useSlidInList(models, firstScreen);
  const [doomed, setDoomed] = useState<LocalModel | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const deleting = useAction();
  const importing = useAction();

  const confirmDelete = () => {
    const m = doomed;
    setDoomed(null);
    if (m) void deleting.run(() => remove(m.id));
  };

  return (
    <>
      <SectionTitle>On this phone</SectionTitle>
      {models.length === 0 ? <Note>No models yet: download one below, or import a GGUF file.</Note> : null}
      {shown.map((m) => {
        const reduced = reducedLine(m);
        const choosable = canChoose(m.contextRange) || m.contextChoice != null;
        return (
          <ModelPanel key={m.id} title={m.name} lines={[modelLine(m), sourceText(m.source)]} dates={m.dates} ram={m.ram} note={reduced}>
            {editing === m.id ? <ContextSetting model={m} onDone={() => setEditing(null)} /> : null}
            <XStack gap="2">
              {choosable && editing !== m.id ? (
                <AppButton flex={1} variant="secondary" onPress={() => setEditing(m.id)}>
                  {contextButtonText(m)}
                </AppButton>
              ) : null}
              <AppButton flex={choosable ? 1 : undefined} variant="secondary" onPress={() => setDoomed(m)}>
                Delete
              </AppButton>
            </XStack>
          </ModelPanel>
        );
      })}
      {deleting.error ? <Note tone="error">{deleting.error}</Note> : null}
      <AppButton variant="secondary" loading={importing.busy} onPress={() => void importing.run(importFromPhone)}>
        Import a model file
      </AppButton>
      {importing.error ? <Note tone="error">{importing.error}</Note> : null}
      <ConfirmDialog
        open={doomed != null}
        onClose={() => setDoomed(null)}
        title={`Delete ${doomed?.name ?? ''}?`}
        message={doomed ? `Its ${formatBytes(doomed.sizeBytes)} leave the phone. You can download it again later.` : ''}
        onConfirm={confirmDelete}
      />
    </>
  );
}
