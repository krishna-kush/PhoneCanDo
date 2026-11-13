import { useEffect, useState } from 'react';
import { XStack, YStack } from 'tamagui';
import { useAccountStore } from '../../state/account';
import { useAppStore } from '../../state/app';
import { syncLinksWithAccount } from '../../state/flows/account';
import { linksTracked, refreshShareStats } from '../../state/flows/share';
import { useShareStore } from '../../state/share';
import AppButton from '../common/AppButton';
import AgentFace from '../common/face/AgentFace';
import PageHeader from '../common/PageHeader';
import PlainText from '../common/PlainText';
import Screen from '../common/Screen';
import SectionTitle from '../common/SectionTitle';
import Note from '../env/parts/Note';
import { usePageActive } from '../nav/pageActive';
import { pageKicker } from '../settings/logic/hub';
import {
  FUNNEL_TITLE,
  LINKS_TITLE,
  REFER_INSTALL_NOTE,
  REFER_KICKER_LINE,
  REFER_LEAD,
  REFER_PRIVACY,
  REFER_SHARE,
  REFER_TITLE,
  SIGN_IN_HINT,
  STATS_FAILED,
  STATS_LOADING,
  UNTRACKED_DEBUG,
  UNTRACKED_STATS_OFF,
} from './copy';
import FunnelBlock from './FunnelBlock';
import LinkList from './LinkList';
import { funnel, funnelSteps } from './logic/funnel';
import { shareApp } from './share';

// Settings → Tell a friend: Share, then what the links did (the funnel
// over all of them, then each one), read from the server whenever the page
// is in front and after a share. Untracked shares say why; one line says
// what we count and never. Signed in, the account's links join first.
export default function ReferPage() {
  const active = usePageActive();
  const links = useShareStore((s) => s.links);
  const stats = useShareStore((s) => s.stats);
  const status = useShareStore((s) => s.statsStatus);
  const telemetry = useAppStore((s) => s.telemetry);
  const signedIn = useAccountStore((s) => s.signedIn);
  const signInOffered = useAccountStore((s) => s.supported && s.configured);
  const [hop, setHop] = useState(0);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!active) return;
    useAccountStore.getState().hydrate();
    void syncLinksWithAccount().then(refreshShareStats);
  }, [active]);

  async function share() {
    setSharing(true);
    try {
      const r = await shareApp();
      if (r.shared) setHop((n) => n + 1);
    } finally {
      setSharing(false);
    }
    void refreshShareStats();
  }

  const tracked = telemetry.ready && linksTracked();
  const untrackedWhy = !telemetry.ready || tracked ? null : __DEV__ && telemetry.enabled ? UNTRACKED_DEBUG : UNTRACKED_STATS_OFF;

  return (
    <Screen>
      <PageHeader kicker={pageKicker('refer')} title={REFER_TITLE} />
      <XStack alignItems="center" gap="3" paddingBottom="1">
        <YStack onPress={() => setHop((n) => n + 1)} hitSlop={12} accessibilityRole="button" accessibilityLabel="A-01, the mascot. Tap it.">
          <AgentFace mood="happy" size={30} hop={hop} hearts={hop > 0 ? 2 : 0} still={!active} />
        </YStack>
        <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.4} color="dim" textTransform="uppercase" flexShrink={1}>
          {`A-01 · ${REFER_KICKER_LINE}`}
        </PlainText>
      </XStack>
      <PlainText fontSize={15} color="muted">
        {REFER_LEAD}
      </PlainText>
      <AppButton loading={sharing} onPress={() => void share()}>
        {REFER_SHARE}
      </AppButton>
      {untrackedWhy ? <Note>{untrackedWhy}</Note> : null}
      <SectionTitle>{FUNNEL_TITLE}</SectionTitle>
      <FunnelBlock steps={funnelSteps(funnel(links, stats))} />
      {status === 'loading' ? <Note>{STATS_LOADING}</Note> : status === 'failed' ? <Note tone="error">{STATS_FAILED}</Note> : null}
      <Note>{REFER_INSTALL_NOTE}</Note>
      <SectionTitle>{LINKS_TITLE}</SectionTitle>
      <LinkList links={links} stats={stats} />
      {!signedIn && signInOffered && links.some((l) => l.code) ? <Note>{SIGN_IN_HINT}</Note> : null}
      <PlainText fontSize={13} color="muted">
        {REFER_PRIVACY}
      </PlainText>
    </Screen>
  );
}
