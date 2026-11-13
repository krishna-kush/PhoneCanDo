import { useState } from 'react';
import { useAccountStore } from '../../state/account';
import { deleteMyAccount, signOutOfAccount } from '../../state/flows/account';
import AppButton from '../common/AppButton';
import AppCard from '../common/AppCard';
import ConfirmDialog from '../common/ConfirmDialog';
import PlainText from '../common/PlainText';
import {
  DELETE,
  DELETE_CONFIRM_MESSAGE,
  DELETE_CONFIRM_TITLE,
  DELETE_NOTE,
  DELETED,
  SIGN_OUT,
  SIGN_OUT_NOTE,
  SIGNED_IN_AS,
  sinceLine,
  SYNCED,
  WHAT_WE_KEEP,
} from './copy';

// Signed in: who (name and email from the sign-in, kept on this phone; the
// photo is not loaded, as that would be one more call to Google), since
// when, what follows you, Sign out and Delete account behind a confirm.
export default function SignedInBlock({ onDeleted }: { onDeleted: (message: string) => void }) {
  const profile = useAccountStore((s) => s.profile);
  const account = useAccountStore((s) => s.account);
  const busy = useAccountStore((s) => s.busy);
  const [confirm, setConfirm] = useState(false);
  const email = account?.email ?? profile?.email ?? '';

  return (
    <>
      <AppCard title={profile?.name || email || SIGNED_IN_AS} subtitle={profile?.name ? email : undefined} chevron={false}>
        <PlainText fontFamily="mono" fontSize={11} color="secondaryInk" numberOfLines={1}>
          {account ? `${SIGNED_IN_AS} · ${sinceLine(account.createdAt)}` : SIGNED_IN_AS}
        </PlainText>
      </AppCard>
      <PlainText fontSize={15} color="muted">
        {SYNCED}
      </PlainText>
      <PlainText fontSize={13} color="muted">
        {WHAT_WE_KEEP}
      </PlainText>
      <AppButton variant="secondary" loading={busy === 'signOut'} disabled={busy != null} onPress={() => void signOutOfAccount()}>
        {SIGN_OUT}
      </AppButton>
      <PlainText fontSize={13} color="muted">
        {SIGN_OUT_NOTE}
      </PlainText>
      <AppButton variant="danger" loading={busy === 'delete'} disabled={busy != null} onPress={() => setConfirm(true)}>
        {DELETE}
      </AppButton>
      <PlainText fontSize={13} color="muted">
        {DELETE_NOTE}
      </PlainText>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={DELETE_CONFIRM_TITLE}
        message={DELETE_CONFIRM_MESSAGE}
        confirmLabel={DELETE}
        onConfirm={() => {
          setConfirm(false);
          void deleteMyAccount().then((gone) => {
            if (gone) onDeleted(DELETED);
          });
        }}
      />
    </>
  );
}
