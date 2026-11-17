import { useState } from 'react';
import { getBuildChannel, isRunnerAvailable } from '../../engine/runner';
import { installedVersion } from '../../engine/updates/manifest';
import { useAppStore } from '../../state/app';
import { useStarterStore } from '../../state/starter';
import LicensesDialog from '../common/LicensesDialog';
import LinkRow from '../common/LinkRow';
import PageHeader from '../common/PageHeader';
import PlainText from '../common/PlainText';
import RowGroup from '../common/rows/RowGroup';
import Screen from '../common/Screen';
import { SHIFT_TITLE } from '../starter/copy';
import Credits from './about/Credits';
import SpecPlate from './about/SpecPlate';

function channel(): string {
  try {
    return isRunnerAvailable() ? getBuildChannel() : 'full';
  } catch {
    return 'full';
  }
}

// What the app is: its spec plate (A-01 lives there: tap it, and keep
// tapping; swipe the plate for the postcard on its back), what it does in
// words, the end credits, then the first shift again (on, with its marks
// kept) and the licences.
export default function AboutPage() {
  const version = installedVersion();
  const push = useAppStore((s) => s.push);
  const [licensesOpen, setLicensesOpen] = useState(false);

  return (
    <Screen>
      <PageHeader kicker="fig. 00 · about" title="PhoneCanDo" />
      <SpecPlate version={version.version} versionCode={version.versionCode} channel={channel()} />
      <PlainText fontSize={15} color="muted">
        On-device coding agents for Android. Home is the active agent's own UI, its web UI or its terminal UI. Tap
        its name up top for every agent, a new one, the models and settings; its ⋮ menu opens its terminal UI in
        any folder of its Linux home, or a shell in its machine.
      </PlainText>
      <Credits />
      <RowGroup title="Again, and the small print" barcode="aboutLinks">
        <LinkRow
          label={SHIFT_TITLE}
          note="The newcomer's guide from the top, your marks kept"
          onPress={() => {
            useStarterStore.getState().start();
            push({ name: 'starter' });
          }}
        />
        <LinkRow label="Licenses" note="Every part we ship, under its own licence" onPress={() => setLicensesOpen(true)} />
      </RowGroup>
      <LicensesDialog open={licensesOpen} onClose={() => setLicensesOpen(false)} />
    </Screen>
  );
}
