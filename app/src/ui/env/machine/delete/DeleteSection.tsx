import { useState } from 'react';
import type { Image } from '../../../../engine/linux/types';
import { deleteUnusedImage } from '../../../../state/flows/deleteAgentAndImage';
import ActionDeck from '../../../common/actions/ActionDeck';
import { DANGER_DECK_TITLE } from '../../../common/actions/copy';
import ConfirmDialog from '../../../common/ConfirmDialog';
import { linuxFailureText } from '../../logic/errorText';
import Note from '../../parts/Note';

// The Danger zone of a machine no agent uses (a setup cut short left it
// behind): Delete machine, behind a confirm. Once it is gone, its page
// says so.
export default function DeleteSection({ image }: { image: Image }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = () => {
    setConfirm(false);
    setBusy(true);
    setError(null);
    deleteUnusedImage(image.id)
      .catch((e: unknown) => setError(linuxFailureText(e)))
      .finally(() => setBusy(false));
  };

  return (
    <>
      <ActionDeck
        title={DANGER_DECK_TITLE}
        barcode="deckMachineDanger"
        actions={[{ label: 'Delete machine', role: 'danger', loading: busy, onPress: () => setConfirm(true) }]}
      />
      {error ? <Note tone="error">{error}</Note> : null}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this machine?"
        message="No agent uses it: a setup that was cut short left it behind."
        onConfirm={remove}
      />
    </>
  );
}
