import { useEffect, useRef, useState } from 'react';
import { AppState, Modal } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useAppStore } from '../../state/app';
import {
  canInstallUpdates,
  checkForUpdate,
  downloadUpdate,
  installedVersion,
  installDownloaded,
  isLiteUpgrade,
  openInstallSettings,
  type UpdateProgress,
  type UpdateManifest,
} from '../../engine/updates';
import { track } from '../../engine/telemetry';
import { offerAtLaunch } from '../../state/logic/updateOffer';
import AppButton from './AppButton';

type Phase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'none'
  | 'downloading'
  | 'permission'
  | 'installing'
  | 'ready'
  | 'error';

function mb(bytes?: number): string {
  return bytes && bytes > 0 ? `${Math.round(bytes / 1048576)} MB` : '';
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// How long after launch the background check waits, so it never slows the start.
const LAUNCH_CHECK_MS = 2000;

// Checks GitHub quietly in the background two seconds after launch and keeps
// what it found for Settings (the Updates row). The box opens by itself only
// for a newer build it has not offered before, never in a debug build, and
// on lite not while its offer is off (state/logic/updateOffer.ts); walking
// away keeps it shut until the next build. Settings → Updates re-runs the
// check on demand through the store nonce and always answers. Android
// always shows its own installer; the best this can do is download and
// hand the APK over.
export default function UpdateDialog() {
  const current = installedVersion();
  const lite = isLiteUpgrade();
  const nonce = useAppStore((s) => s.updatePromptNonce);
  const hydrated = useAppStore((s) => s.hydrated);
  const [phase, setPhase] = useState<Phase>('idle');
  const [manifest, setManifest] = useState<UpdateManifest | null>(null);
  const [progress, setProgress] = useState<UpdateProgress>({ written: 0, total: 0 });
  const [error, setError] = useState('');
  const fileRef = useRef<Awaited<ReturnType<typeof downloadUpdate>> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const checkRef = useRef<AbortController | null>(null);

  // Settings → Updates: the box opens at once and says what it found, even nothing newer.
  async function check() {
    checkRef.current?.abort();
    const ctrl = new AbortController();
    checkRef.current = ctrl;
    setPhase('checking');
    try {
      const m = await checkForUpdate(ctrl.signal);
      if (ctrl.signal.aborted) return;
      track(m ? 'update.check.newer' : 'update.check.none', { manual: true });
      useAppStore.getState().setUpdateReady(m?.version ?? null);
      if (m) {
        setManifest(m);
        setPhase('available');
        track('update.offered', { version: m.version, lite });
      } else {
        setPhase('none');
      }
    } catch (e) {
      if (ctrl.signal.aborted) return;
      track('update.check.failed', { manual: true });
      setError(`Could not reach GitHub: ${errText(e)}`);
      setPhase('error');
    }
  }

  // At launch, in the background: says nothing unless offerAtLaunch opens the box.
  async function launchCheck() {
    checkRef.current?.abort();
    const ctrl = new AbortController();
    checkRef.current = ctrl;
    try {
      const m = await checkForUpdate(ctrl.signal);
      if (ctrl.signal.aborted) return;
      track(m ? 'update.check.newer' : 'update.check.none', { manual: false });
      const app = useAppStore.getState();
      app.setUpdateReady(m?.version ?? null);
      const offer = offerAtLaunch({
        newer: m?.versionCode ?? null,
        offered: app.updateOffered,
        debug: __DEV__,
        lite,
        muted: app.updatePromptMuted,
      });
      if (!m || !offer) return;
      void app.setUpdateOffered(m.versionCode);
      setManifest(m);
      setPhase('available');
      track('update.offered', { version: m.version, lite });
    } catch {
      // Offline at launch: the site is the fallback.
      if (!ctrl.signal.aborted) track('update.check.failed', { manual: false });
    }
  }

  useEffect(() => {
    // Lite with its offer off asks GitHub nothing at launch (docs/telemetry.md).
    if (!hydrated || (lite && useAppStore.getState().updatePromptMuted)) return;
    const timer = setTimeout(() => void launchCheck(), LAUNCH_CHECK_MS);
    return () => {
      clearTimeout(timer);
      checkRef.current?.abort();
    };
    // Launch-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Settings → Updates.
  useEffect(() => {
    if (nonce > 0) void check();
  }, [nonce]);

  async function downloadAndInstall() {
    if (!manifest) return;
    track('update.accepted', { version: manifest.version, lite });
    if (__DEV__) {
      // Debug signature: Android refuses the release APK over this app.
      setError(
        'Dev build: Android will not install the release APK over a debug-signed app. Test the install with the release lite build.',
      );
      setPhase('error');
      return;
    }
    setError('');
    setProgress({ written: 0, total: 0 });
    setPhase('downloading');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const file = await downloadUpdate(manifest, {
        signal: ctrl.signal,
        onProgress: setProgress,
      });
      fileRef.current = file;
      track('update.downloaded', { version: manifest.version });
      await install();
    } catch (e) {
      if (ctrl.signal.aborted) {
        setPhase('available');
        return;
      }
      track('update.failed', { stage: 'download' });
      setError(errText(e));
      setPhase('error');
    } finally {
      abortRef.current = null;
    }
  }

  async function install() {
    const file = fileRef.current;
    if (!file) {
      void downloadAndInstall();
      return;
    }
    setError('');
    // Without Android's "Install unknown apps" switch the installer would
    // open Android's own prompt over this dialog; ask here first instead.
    if (!canInstallUpdates()) {
      setPhase('permission');
      return;
    }
    setPhase('installing');
    try {
      await installDownloaded(file);
      // The app survives only if the user backed out of the installer.
      // (A finished install replaces the process; telemetry counts it as
      // update.installed on the next launch.)
      track('update.cancelled', { stage: 'installer' });
      setPhase('ready');
    } catch (e) {
      track('update.failed', { stage: 'install' });
      setError(errText(e));
      setPhase('error');
    }
  }

  // Back from Android's settings with the switch on: install by itself.
  useEffect(() => {
    if (phase !== 'permission') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && canInstallUpdates()) void install();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function close() {
    // Walking away from the offer, the download or Android's install switch.
    if (phase === 'available' || phase === 'downloading' || phase === 'permission') {
      track('update.cancelled', { stage: phase === 'available' ? 'offer' : phase });
    }
    abortRef.current?.abort();
    checkRef.current?.abort();
    setPhase('idle');
  }

  const open = phase !== 'idle';
  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.written / progress.total) * 100)) : 0;
  const pitch = phase === 'checking' || phase === 'available';

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <YStack
        flex={1}
        backgroundColor="rgba(0,0,0,0.6)"
        alignItems="center"
        justifyContent="center"
        padding="5"
      >
        <YStack
          backgroundColor="panel"
          borderWidth={1}
          borderColor="lineStrong"
          borderRadius={0}
          padding="4"
          gap="3"
          width="100%"
          maxWidth={360}
        >
          {pitch && lite ? (
            <>
              <Text fontSize={19} fontWeight="700">
                Give it hands
              </Text>
              <Text fontSize={15} color="color10">
                This starter build is a brain in a jar: it chats and runs a terminal, but it
                cannot touch your phone. Ask it to open WhatsApp and it shrugs.
              </Text>
              <Text fontSize={14} color="color10">
                The full build adds eyes and hands: it reads the screen, taps, types and scrolls,
                behind your fingerprint. It installs over this one. Nothing is lost.
              </Text>
              <Text fontSize={13} color="color10">
                {manifest
                  ? `Full build ${manifest.version}${manifest.size ? ` · ${mb(manifest.size)}` : ''}. Android asks once to allow installs from PhoneCanDo, then confirms.`
                  : 'Fetching the latest release…'}
              </Text>
              <XStack gap="2" marginTop="2">
                <AppButton variant="secondary" flex={1} onPress={close}>
                  Later
                </AppButton>
                <AppButton flex={1} loading={!manifest} onPress={() => void downloadAndInstall()}>
                  {manifest ? 'Install full build' : 'Fetching'}
                </AppButton>
              </XStack>
            </>
          ) : null}

          {pitch && !lite ? (
            <>
              <Text fontSize={19} fontWeight="700">
                {manifest ? 'Update available' : 'Checking for updates'}
              </Text>
              <Text fontSize={15} color="color10">
                {manifest
                  ? `PhoneCanDo ${current.version} → ${manifest.version}${manifest.size ? ` · ${mb(manifest.size)}` : ''}`
                  : `Asking GitHub for anything newer than ${current.version}…`}
              </Text>
              {manifest?.notes ? (
                <Text fontSize={14} color="color10">
                  {manifest.notes}
                </Text>
              ) : null}
              {manifest ? (
                <Text fontSize={13} color="color10">
                  Android will ask you to confirm the install. Your data is kept.
                </Text>
              ) : null}
              <XStack gap="2" marginTop="2">
                <AppButton variant="secondary" flex={1} onPress={close}>
                  Later
                </AppButton>
                <AppButton flex={1} loading={!manifest} onPress={() => void downloadAndInstall()}>
                  {manifest ? 'Update' : 'Checking'}
                </AppButton>
              </XStack>
            </>
          ) : null}

          {phase === 'none' ? (
            <>
              <Text fontSize={19} fontWeight="700">
                Up to date
              </Text>
              <Text fontSize={15} color="color10">
                PhoneCanDo {current.version} is the latest release.
              </Text>
              <XStack gap="2" marginTop="2">
                <AppButton flex={1} onPress={close}>
                  Close
                </AppButton>
              </XStack>
            </>
          ) : null}

          {phase === 'downloading' ? (
            <>
              <Text fontSize={19} fontWeight="700">
                Downloading {lite ? 'the full build' : 'update'}
              </Text>
              <Text fontSize={15} color="color10">
                {pct}%{progress.total > 0 ? ` · ${mb(progress.written)} of ${mb(progress.total)}` : ''}
              </Text>
              <YStack height={6} backgroundColor="line" width="100%">
                <YStack height={6} backgroundColor="primary" width={`${pct}%`} />
              </YStack>
              <Text fontSize={13} color="color10">
                Keep the app open. The install starts when the download finishes.
              </Text>
              <XStack gap="2" marginTop="2">
                <AppButton variant="secondary" flex={1} onPress={close}>
                  Cancel
                </AppButton>
              </XStack>
            </>
          ) : null}

          {phase === 'permission' ? (
            <>
              <Text fontSize={19} fontWeight="700">
                One quick OK from Android
              </Text>
              <Text fontSize={15} color="color10">
                Android asks before any app installs something, even its own update. Tap Open
                settings, switch on "Allow from this source" for PhoneCanDo, then come back. The
                install starts by itself.
              </Text>
              <XStack gap="2" marginTop="2">
                <AppButton variant="secondary" flex={1} onPress={close}>
                  Later
                </AppButton>
                <AppButton flex={1} onPress={() => void openInstallSettings()}>
                  Open settings
                </AppButton>
              </XStack>
            </>
          ) : null}

          {phase === 'installing' ? (
            <>
              <Text fontSize={19} fontWeight="700">
                Opening installer
              </Text>
              <Text fontSize={15} color="color10">
                Confirm the install in Android's dialog. When it says "App installed", tap Open.
                If you miss it, a notification brings you back.
              </Text>
            </>
          ) : null}

          {phase === 'ready' ? (
            <>
              <Text fontSize={19} fontWeight="700">
                Ready to install
              </Text>
              <Text fontSize={15} color="color10">
                The download is done. If you dismissed Android's installer, try again below.
              </Text>
              <XStack gap="2" marginTop="2">
                <AppButton variant="secondary" flex={1} onPress={close}>
                  Later
                </AppButton>
                <AppButton flex={1} onPress={() => void install()}>
                  Install
                </AppButton>
              </XStack>
            </>
          ) : null}

          {phase === 'error' ? (
            <>
              <Text fontSize={19} fontWeight="700">
                {manifest ? 'Install failed' : 'Check failed'}
              </Text>
              <Text fontSize={15} color="color10">
                {error}
              </Text>
              {manifest ? (
                <AppButton variant="secondary" onPress={() => void openInstallSettings()}>
                  Open install settings
                </AppButton>
              ) : null}
              <XStack gap="2" marginTop="2">
                <AppButton variant="secondary" flex={1} onPress={close}>
                  Close
                </AppButton>
                <AppButton
                  flex={1}
                  onPress={() => (manifest ? void downloadAndInstall() : void check())}
                >
                  Retry
                </AppButton>
              </XStack>
            </>
          ) : null}
        </YStack>
      </YStack>
    </Modal>
  );
}
