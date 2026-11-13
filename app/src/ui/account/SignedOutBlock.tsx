import { useAccountStore } from '../../state/account';
import { signInWithGoogle } from '../../state/flows/account';
import AppButton from '../common/AppButton';
import PlainText from '../common/PlainText';
import Note from '../env/parts/Note';
import { NO_PLAY_SERVICES, NOT_CONFIGURED, SIGN_IN, WHAT_WE_KEEP, WHY } from './copy';

// Signed out: why you might sign in, what we'd keep, and the button, or
// why there is none (no Google Play services, or a build without our client).
export default function SignedOutBlock() {
  const supported = useAccountStore((s) => s.supported);
  const configured = useAccountStore((s) => s.configured);
  const busy = useAccountStore((s) => s.busy);
  return (
    <>
      <PlainText fontSize={15} color="muted">
        {WHY}
      </PlainText>
      {!supported ? (
        <Note>{NO_PLAY_SERVICES}</Note>
      ) : !configured ? (
        <Note>{NOT_CONFIGURED}</Note>
      ) : (
        <AppButton loading={busy === 'signIn'} disabled={busy != null} onPress={() => void signInWithGoogle()}>
          {SIGN_IN}
        </AppButton>
      )}
      <PlainText fontSize={13} color="muted">
        {WHAT_WE_KEEP}
      </PlainText>
    </>
  );
}
