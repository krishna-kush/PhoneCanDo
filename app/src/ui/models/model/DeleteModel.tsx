import { useState } from 'react';
import type { LocalModel } from '../../../engine/models/types';
import { remove } from '../../../state/flows/modelActions';
import AppButton from '../../common/AppButton';
import ConfirmDialog from '../../common/ConfirmDialog';
import SectionTitle from '../../common/SectionTitle';
import { formatBytes } from '../../env/logic/format';
import Note from '../../env/parts/Note';
import { useAction } from '../useAction';

// A model's Delete, asking first: its files leave the phone. Refused while
// an agent is set to it (the error names them); `onDeleted` once it is gone.
export default function DeleteModel({ model, onDeleted }: { model: LocalModel; onDeleted: () => void }) {
  const [asking, setAsking] = useState(false);
  const deleting = useAction();

  const confirm = () => {
    setAsking(false);
    void deleting.run(() => remove(model.id)).then((ok) => {
      if (ok) onDeleted();
    });
  };

  return (
    <>
      <SectionTitle>Delete</SectionTitle>
      <AppButton variant="danger" loading={deleting.busy} onPress={() => setAsking(true)}>
        Delete
      </AppButton>
      {deleting.error ? <Note tone="error">{deleting.error}</Note> : null}
      <ConfirmDialog
        open={asking}
        onClose={() => setAsking(false)}
        title={`Delete ${model.name}?`}
        message={`Its ${formatBytes(model.sizeBytes)} leave the phone. You can download it again later.`}
        onConfirm={confirm}
      />
    </>
  );
}
