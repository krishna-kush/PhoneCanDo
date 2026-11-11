import { useState } from 'react';
import { XStack } from 'tamagui';
import { useAppStore, type ThemeMode } from '../../state/app';
import * as runner from '../../engine/runner';
import { installedVersion } from '../../engine/updates';
import AppButton from '../common/AppButton';
import AppCard from '../common/AppCard';
import LicensesDialog from '../common/LicensesDialog';
import PageHeader from '../common/PageHeader';
import Screen from '../common/Screen';
import SectionTitle from '../common/SectionTitle';
import LogoMark from '../common/LogoMark';
import { useScheme } from '../common/globals';
import AfterSlide from '../nav/AfterSlide';
import PhoneControlSection from './PhoneControlSection';
import PrivacySection from './PrivacySection';
import TerminalSection from './TerminalSection';
import UpdateSection from './UpdateSection';

const runnerAvailable = runner.isRunnerAvailable();
const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

// App-wide options only: about and licences, updates, theme, the terminal's
// extra keys, phone control, privacy. Each agent's engine, reset and delete
// live on its page (the drawer's › beside it). A phone's first screen ends
// around Phone control's Accessibility card; what follows it there, and
// Privacy, mount once the page has slid in.
export default function SettingsScreen() {
  const scheme = useScheme();
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const [licensesOpen, setLicensesOpen] = useState(false);
  // For our own test phones: long-press About reveals the tester-device switch.
  const [showTester, setShowTester] = useState(false);
  const version = installedVersion();
  // Build channel (only full ships the automation driver).
  // Sync native call; pre-channel installs and Expo Go read as full.
  let channel = 'full';
  try {
    if (runnerAvailable) channel = runner.getBuildChannel();
  } catch {
    // native bridge absent
  }

  return (
    <Screen>
      <PageHeader kicker="app-wide" title="Settings" />
      <SectionTitle>About</SectionTitle>
      <AppCard
        title="PhoneCanDo on-device agent"
        subtitle={`v${version.version} (${version.versionCode}) · theme ${scheme} · channel ${channel}`}
        chevron={false}
        icon={<LogoMark size={36} />}
        plate={false}
        onLongPress={() => setShowTester((v) => !v)}
      />
      <AppButton variant="secondary" onPress={() => setLicensesOpen(true)}>
        Licenses
      </AppButton>

      {/* Lite has no phone control; saying so belongs next to what the build is. */}
      {channel === 'lite' ? <PhoneControlSection channel={channel} /> : null}

      <UpdateSection channel={channel} />

      <SectionTitle>Appearance</SectionTitle>
      <XStack gap="2">
        {THEME_MODES.map((mode) => (
          <AppButton
            key={mode}
            flex={1}
            variant={themeMode === mode ? 'primary' : 'secondary'}
            onPress={() => void setThemeMode(mode)}
            accessibilityState={{ selected: themeMode === mode }}
          >
            {mode}
          </AppButton>
        ))}
      </XStack>

      <TerminalSection />

      {channel !== 'lite' ? <PhoneControlSection channel={channel} /> : null}

      <AfterSlide>
        <PrivacySection showTester={showTester} />
      </AfterSlide>

      <LicensesDialog open={licensesOpen} onClose={() => setLicensesOpen(false)} />
    </Screen>
  );
}
