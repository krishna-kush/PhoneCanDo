import { useEffect, useState } from 'react';
import { getBuildChannel } from '../../engine/runner';
import { runLimits } from '../../engine/runLimits';
import { installedVersion } from '../../engine/updates/manifest';
import { useAccountStore } from '../../state/account';
import { useAppStore } from '../../state/app';
import { useShareStore } from '../../state/share';
import { useUpdateFact } from '../update/useUpdateFact';
import LinkRow from '../common/LinkRow';
import PageHeader from '../common/PageHeader';
import RowGroup from '../common/rows/RowGroup';
import Screen from '../common/Screen';
import { usePageActive } from '../nav/pageActive';
import { hubRows, type HubFacts } from './logic/hub';
import PhoneControlSection from './PhoneControlSection';
import ShiftBoard from './phone-control/ShiftBoard';

// Settings: A-01 on its board under the title (ShiftBoard), Phone control
// on the page itself, at the top (it gates what agents may do, so it is
// never a tap away), then a short hub of one row
// per page (Account, Look & feel, Agents & models, Privacy, Updates, Tell
// a friend, About), each with a line of what is inside and how it is set
// now. App-wide options only: each agent's own settings live on its page.
// The rows re-read what they show whenever Settings is back in front.
export default function SettingsScreen() {
  const push = useAppStore((s) => s.push);
  const themeMode = useAppStore((s) => s.themeMode);
  const extraKeysSticky = useAppStore((s) => s.extraKeysSticky);
  const telemetry = useAppStore((s) => s.telemetry);
  const update = useUpdateFact();
  const signedIn = useAccountStore((s) => s.signedIn);
  const email = useAccountStore((s) => s.account?.email ?? s.profile?.email ?? null);
  const signInOffered = useAccountStore((s) => s.supported && s.configured);
  const sharesSent = useShareStore((s) => s.links.length);
  const active = usePageActive();
  const [limits, setLimits] = useState(runLimits);

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
    update,
    account: { signedIn, email, offered: signInOffered },
    sharesSent,
  };

  return (
    <Screen>
      <PageHeader kicker="app-wide" title="Settings" />
      <ShiftBoard active={active} />
      <PhoneControlSection channel={facts.channel} />
      <RowGroup title="Everything else" barcode="settingsHub">
        {hubRows(facts).map((row) => (
          <LinkRow
            key={row.target}
            label={row.title}
            note={row.line}
            now={row.now}
            onPress={() => push(row.target === 'about' ? { name: 'about' } : { name: 'settings-page', page: row.target })}
          />
        ))}
      </RowGroup>
    </Screen>
  );
}
