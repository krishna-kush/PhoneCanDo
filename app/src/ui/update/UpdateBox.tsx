import { useEffect } from 'react';
import { AppState, Modal, ScrollView, useWindowDimensions } from 'react-native';
import { YStack } from 'tamagui';
import { canInstallUpdates } from '../../engine/updates/install';
import { isLiteUpgrade } from '../../engine/updates/manifest';
import { useAppStore } from '../../state/app';
import { closeBox } from '../../state/flows/update/box';
import { launchCheck } from '../../state/flows/update/check';
import { followDownloads } from '../../state/flows/update/download';
import { install } from '../../state/flows/update/install';
import { useUpdateStore } from '../../state/update';
import DownloadStep from './steps/DownloadStep';
import InstallStep from './steps/InstallStep';
import NoneStep from './steps/NoneStep';
import OfferStep from './steps/OfferStep';
import PermissionStep from './steps/PermissionStep';
import ProblemStep from './steps/ProblemStep';
import StopStep from './steps/StopStep';

// How long after launch the background check waits, so it never slows the start.
const LAUNCH_CHECK_MS = 2000;
// The share of the screen the box may take before it scrolls.
const MAX_SHARE = 0.86;

// The in-app update, mounted once over every page. An update takes two
// steps, each on its own tap: Download, which stops nothing (hide the box
// and keep working; it comes back when the parcel is in), then Install,
// which says what it will stop first, stops the agents and hands the APK
// to Android's installer. Checks GitHub quietly two seconds after launch
// (flows/update/check.ts says when the box opens by itself); Settings →
// Updates opens it any time.
export default function UpdateBox() {
  const lite = isLiteUpgrade();
  const hydrated = useAppStore((s) => s.hydrated);
  const shown = useUpdateStore((s) => s.shown);
  const step = useUpdateStore((s) => s.step);
  const manifest = useUpdateStore((s) => s.manifest);
  const error = useUpdateStore((s) => s.error);
  const { height } = useWindowDimensions();

  // A download the runner carried on through a restart, or finished, shows from the start.
  useEffect(() => followDownloads(), []);

  useEffect(() => {
    // Lite with its offer off asks GitHub nothing at launch (docs/telemetry.md).
    if (!hydrated || (lite && useAppStore.getState().updatePromptMuted)) return;
    const timer = setTimeout(() => void launchCheck(), LAUNCH_CHECK_MS);
    return () => clearTimeout(timer);
    // Launch-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Back from Android's settings with the switch on: the install carries on by itself.
  useEffect(() => {
    if (step !== 'permission') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && canInstallUpdates()) void install();
    });
    return () => sub.remove();
  }, [step]);

  const open = shown && step != null;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={closeBox}>
      <YStack flex={1} backgroundColor="scrimSoft" alignItems="center" justifyContent="center" padding="5">
        <YStack
          backgroundColor="panel"
          borderWidth={1}
          borderColor="lineStrong"
          width="100%"
          maxWidth={360}
          maxHeight={height * MAX_SHARE}
        >
          <ScrollView bounces={false} contentContainerStyle={{ padding: 16, gap: 12 }}>
            {open ? <Step step={step} manifest={manifest} error={error} lite={lite} /> : null}
          </ScrollView>
        </YStack>
      </YStack>
    </Modal>
  );
}

type StepProps = {
  step: NonNullable<ReturnType<typeof useUpdateStore.getState>['step']>;
  manifest: ReturnType<typeof useUpdateStore.getState>['manifest'];
  error: ReturnType<typeof useUpdateStore.getState>['error'];
  lite: boolean;
};

function Step({ step, manifest, error, lite }: StepProps) {
  switch (step) {
    case 'checking':
    case 'offer':
      return <OfferStep manifest={manifest} lite={lite} />;
    case 'none':
      return <NoneStep />;
    case 'downloading':
      return manifest ? <DownloadStep manifest={manifest} lite={lite} /> : null;
    case 'downloaded':
      return manifest ? <InstallStep manifest={manifest} lite={lite} /> : null;
    case 'permission':
      return <PermissionStep />;
    case 'stopping':
    case 'installer':
    case 'cancelled':
      return <StopStep step={step} />;
    case 'error':
      return <ProblemStep stage={error?.stage ?? 'check'} message={error?.message ?? ''} />;
  }
}
