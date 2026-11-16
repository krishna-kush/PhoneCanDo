import { useState } from 'react';
import { XStack } from 'tamagui';
import { useAccountStore } from '../../state/account';
import { deleteMyAccount, signOutOfAccount } from '../../state/flows/account';
import AppButton from '../common/AppButton';
import ConfirmDialog from '../common/ConfirmDialog';
import BoopFace from '../common/face/BoopFace';
import PlainText from '../common/PlainText';
import LiveLight from '../common/rows/LiveLight';
import { usePageActive } from '../nav/pageActive';
import {
  DELETE,
  DELETE_CONFIRM_MESSAGE,
  DELETE_CONFIRM_TITLE,
  DELETE_NOTE,
  DELETED,
  SIGN_OUT,
  SIGN_OUT_NOTE,
  SYNCED,
  WHAT_WE_KEEP,
} from './copy';
import FollowsBlock from './FollowsBlock';
import { LINKED_LINE, PASS_STAMP, PASS_TITLE, passFields, PHOTO_CAPTION } from './logic/pass';
import CrewPass from './pass/CrewPass';

// Signed in: who, as an issued crew pass (name and email from the sign-in,
// kept on this phone; the photo is not loaded, as that would be one more
// call to Google, so A-01 stands in and hops when tapped), since when, a
// live light for the link and a slammed stamp; what follows you; then
// Sign out and Delete account behind a confirm.
export default function SignedInBlock({ onDeleted }: { onDeleted: (message: string) => void }) {
  const profile = useAccountStore((s) => s.profile);
  const account = useAccountStore((s) => s.account);
  const busy = useAccountStore((s) => s.busy);
  const unreached = useAccountStore((s) => s.error != null);
  const active = usePageActive();
  const [confirm, setConfirm] = useState(false);
  const email = account?.email ?? profile?.email ?? '';

  return (
    <>
      <CrewPass
        title={PASS_TITLE}
        barcode="crewPass"
        fields={passFields({ name: profile?.name ?? null, email }, account?.createdAt ?? null, unreached)}
        blank={false}
        caption={PHOTO_CAPTION}
        stamp={PASS_STAMP}
        photo={
          <BoopFace mood="awake" size={40} still={!active} label="A-01, standing in for your photo. Tap it." />
        }
        foot={
          <XStack alignItems="center" gap="2">
            <LiveLight still={!active} />
            <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} textTransform="uppercase" color="secondaryInk" flexShrink={1}>
              {LINKED_LINE}
            </PlainText>
          </XStack>
        }
      />
      <FollowsBlock signedIn note={SYNCED} />
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
