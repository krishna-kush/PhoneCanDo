import { XStack } from 'tamagui';
import { useAccountStore } from '../../state/account';
import { signInWithGoogle } from '../../state/flows/account';
import AppButton from '../common/AppButton';
import BoopFace from '../common/face/BoopFace';
import type { Mood } from '../common/face/mood';
import PlainText from '../common/PlainText';
import Note from '../env/parts/Note';
import { usePageActive } from '../nav/pageActive';
import { errorLine, NO_PLAY_SERVICES, NOT_CONFIGURED, SIGN_IN, WHAT_WE_KEEP, WHY } from './copy';
import FollowsBlock from './FollowsBlock';
import { BLANK_FIELDS, doorLine, PASS_TITLE_BLANK, PHOTO_CAPTION_BLANK } from './logic/pass';
import CrewPass from './pass/CrewPass';

const DOOR_MOOD: Record<Parameters<typeof doorLine>[0], Mood> = { idle: 'awake', signingIn: 'busy', failed: 'oops' };

// Signed out: why you might sign in, a crew pass not issued yet (faint
// blanks, a dashed photo slot) with A-01 holding the door at its foot
// (looking about while the sign-in runs, puzzled when it fails; it hops
// when tapped), the button, or why there is none (no Google Play services,
// or a build without our client), what would follow you, and what we'd keep.
export default function SignedOutBlock() {
  const supported = useAccountStore((s) => s.supported);
  const configured = useAccountStore((s) => s.configured);
  const busy = useAccountStore((s) => s.busy);
  const failed = useAccountStore((s) => errorLine(s.error) != null);
  const active = usePageActive();
  const door = busy === 'signIn' ? 'signingIn' : failed ? 'failed' : 'idle';

  return (
    <>
      <PlainText fontSize={15} color="muted">
        {WHY}
      </PlainText>
      <CrewPass
        title={PASS_TITLE_BLANK}
        barcode="crewPassBlank"
        fields={BLANK_FIELDS}
        blank
        caption={PHOTO_CAPTION_BLANK}
        foot={
          <XStack alignItems="center" gap="3">
            <BoopFace mood={DOOR_MOOD[door]} size={22} still={!active} label="A-01, holding the door. Tap it." />
            <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} textTransform="uppercase" color="dim" flexShrink={1}>
              {doorLine(door)}
            </PlainText>
          </XStack>
        }
      />
      {!supported ? (
        <Note>{NO_PLAY_SERVICES}</Note>
      ) : !configured ? (
        <Note>{NOT_CONFIGURED}</Note>
      ) : (
        <AppButton loading={busy === 'signIn'} disabled={busy != null} onPress={() => void signInWithGoogle()}>
          {SIGN_IN}
        </AppButton>
      )}
      <FollowsBlock signedIn={false} />
      <PlainText fontSize={13} color="muted">
        {WHAT_WE_KEEP}
      </PlainText>
    </>
  );
}
