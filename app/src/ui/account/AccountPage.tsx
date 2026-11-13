import { useEffect, useState } from 'react';
import { useAccountStore } from '../../state/account';
import { refreshAccount } from '../../state/flows/account';
import PageHeader from '../common/PageHeader';
import PlainText from '../common/PlainText';
import Screen from '../common/Screen';
import Note from '../env/parts/Note';
import { usePageActive } from '../nav/pageActive';
import { pageKicker } from '../settings/logic/hub';
import { errorLine, TITLE } from './copy';
import ComingBlock from './ComingBlock';
import SignedInBlock from './SignedInBlock';
import SignedOutBlock from './SignedOutBlock';

// Settings → Account: optional Google sign-in. Signed out, why and the
// button (or why there is none here); signed in, who, what follows you,
// Sign out and Delete account; then, either way, what sign-in is for next. The account is re-read from the server whenever the page is in
// front, which also notices a session that ended elsewhere.
export default function AccountPage() {
  const active = usePageActive();
  const signedIn = useAccountStore((s) => s.signedIn);
  const error = useAccountStore((s) => s.error);
  const [done, setDone] = useState('');

  useEffect(() => {
    if (!active) return;
    // A failure from an earlier visit is old news.
    useAccountStore.getState().set({ error: null });
    useAccountStore.getState().hydrate();
    void refreshAccount();
  }, [active]);

  const trouble = errorLine(error);
  return (
    <Screen>
      <PageHeader kicker={pageKicker('account')} title={TITLE} />
      {signedIn ? <SignedInBlock onDeleted={setDone} /> : <SignedOutBlock />}
      {trouble ? <Note tone="error">{trouble}</Note> : null}
      {done && !signedIn ? (
        <PlainText fontSize={13} color="muted">
          {done}
        </PlainText>
      ) : null}
      <ComingBlock />
    </Screen>
  );
}
