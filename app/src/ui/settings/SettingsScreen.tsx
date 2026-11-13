import { useEffect, useState } from 'react';
import { XStack, YStack } from 'tamagui';
import { getBuildChannel } from '../../engine/runner';
import { runLimits } from '../../engine/runLimits';
import { installedVersion } from '../../engine/updates';
import { useAccountStore } from '../../state/account';
import { useAppStore } from '../../state/app';
import { useShareStore } from '../../state/share';
import AppCard from '../common/AppCard';
import AgentFace from '../common/face/AgentFace';
import { settingsLine } from '../common/face/lines';
import PageHeader from '../common/PageHeader';
import PlainText from '../common/PlainText';
import Screen from '../common/Screen';
import SectionTitle from '../common/SectionTitle';
import { usePageActive } from '../nav/pageActive';
import { hubRows, type HubFacts } from './logic/hub';
import PhoneControlSection from './PhoneControlSection';

// Settings: Phone control on the page itself, at the top (it gates what
// agents may do, so it is never a tap away), then a short hub of one row
// per page (Account, Look & feel, Agents & models, Privacy, Updates, Tell
// a friend, About), each with a line of what is inside and how it is set
// now. App-wide options only: each agent's own settings live on its page.
// The rows re-read what they show whenever Settings is back in front.
export default function SettingsScreen() {
  const push = useAppStore((s) => s.push);
  const themeMode = useAppStore((s) => s.themeMode);
  const extraKeysSticky = useAppStore((s) => s.extraKeysSticky);
  const telemetry = useAppStore((s) => s.telemetry);
  const signedIn = useAccountStore((s) => s.signedIn);
  const email = useAccountStore((s) => s.account?.email ?? s.profile?.email ?? null);
  const signInOffered = useAccountStore((s) => s.supported && s.configured);
  const sharesSent = useShareStore((s) => s.links.length);
  const active = usePageActive();
  const [limits, setLimits] = useState(runLimits);
  const [line] = useState(() => settingsLine(Math.random() * 1000));
  const [boops, setBoops] = useState(0);

  useEffect(() => {
    if (!active) return;
    setLimits(runLimits());
    useAccountStore.getState().hydrate();
    void useShareStore.getState().hydrate();
  }, [active]);

  const facts: HubFacts = {
    channel: getBuildChannel(),
    themeMode,
    extraKeysSticky,
    limits,
    telemetry: telemetry.ready && telemetry.available ? telemetry.enabled : null,
    version: installedVersion().version,
    account: { signedIn, email, offered: signInOffered },
    sharesSent,
  };

  return (
    <Screen>
      <PageHeader kicker="app-wide" title="Settings" />
      <XStack alignItems="center" gap="3" paddingBottom="1">
        <YStack
          onPress={() => setBoops((n) => n + 1)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="A-01, the mascot. Tap it."
        >
          <AgentFace mood="awake" size={22} hop={boops} still={!active} />
        </YStack>
        <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.4} color="dim" textTransform="uppercase" flexShrink={1}>
          {`A-01 · ${line}`}
        </PlainText>
      </XStack>
      <SectionTitle>Phone control</SectionTitle>
      <PhoneControlSection channel={facts.channel} />
      <SectionTitle>Everything else</SectionTitle>
      {hubRows(facts).map((row, i) => (
        <AppCard
          key={row.target}
          title={row.title}
          subtitle={row.line}
          icon={
            <PlainText fontFamily="mono" fontSize={14} fontWeight="600" color="secondaryInk">
              {String(i + 1).padStart(2, '0')}
            </PlainText>
          }
          onPress={() => push(row.target === 'about' ? { name: 'about' } : { name: 'settings-page', page: row.target })}
        >
          <PlainText fontFamily="mono" fontSize={11} color="secondaryInk" numberOfLines={1}>
            {row.now}
          </PlainText>
        </AppCard>
      ))}
    </Screen>
  );
}
