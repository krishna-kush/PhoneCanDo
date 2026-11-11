import { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import { getBuildChannel, isRunnerAvailable } from '../../engine/runner';
import { installedVersion } from '../../engine/updates';
import AppButton from '../common/AppButton';
import AgentFace from '../common/face/AgentFace';
import { boopLine } from '../common/face/lines';
import LicensesDialog from '../common/LicensesDialog';
import PageHeader from '../common/PageHeader';
import PlainText from '../common/PlainText';
import Screen from '../common/Screen';
import Barcode from './Barcode';

function channel(): string {
  try {
    return isRunnerAvailable() ? getBuildChannel() : 'full';
  } catch {
    return 'full';
  }
}

// What the app is, its version as a real barcode, and the licences. A-01
// lives here too: tap it.
export default function AboutPage() {
  const version = installedVersion();
  const [licensesOpen, setLicensesOpen] = useState(false);
  const [boops, setBoops] = useState(0);

  return (
    <Screen>
      <PageHeader kicker="fig. 00 · about" title="PhoneCanDo" />
      <XStack alignItems="center" gap="4" paddingVertical="3">
        <YStack
          onPress={() => setBoops((n) => n + 1)}
          accessibilityRole="button"
          accessibilityLabel="A-01, the mascot. Tap it."
          hitSlop={12}
        >
          <AgentFace mood="awake" size={48} hop={boops} />
        </YStack>
        <YStack flex={1} gap={4}>
          <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.4} color="dim" textTransform="uppercase">
            {`A-01 · ${boops > 0 ? boopLine(boops - 1) : 'on duty'}`}
          </PlainText>
          <PlainText fontFamily="mono" fontSize={13} color="muted">
            {`v${version.version} (${version.versionCode}) · ${channel()}`}
          </PlainText>
        </YStack>
      </XStack>
      <PlainText fontSize={15} color="muted">
        On-device coding agents for Android. Home is the active agent's own UI, its web UI or its terminal UI. Tap
        its name up top for every agent, a new one, the models and settings; its ⋮ menu opens its terminal UI in
        any folder of its Linux home, or a shell in its machine.
      </PlainText>
      <YStack paddingVertical="3">
        <Barcode text={`PCD ${version.version}`} />
      </YStack>
      <AppButton variant="secondary" onPress={() => setLicensesOpen(true)}>
        Licenses
      </AppButton>
      <LicensesDialog open={licensesOpen} onClose={() => setLicensesOpen(false)} />
    </Screen>
  );
}
