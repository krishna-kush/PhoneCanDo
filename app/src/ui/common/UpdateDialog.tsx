import { useEffect, useRef, useState } from 'react';
import { Modal } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import {
  checkForUpdate,
  downloadUpdate,
  installedVersion,
  installDownloaded,
  openInstallSettings,
  type UpdateProgress,
  type UpdateManifest,
} from '../../engine/updates';
import AppButton from './AppButton';
import { useTheme } from './globals';

type Phase = 'idle' | 'available' | 'downloading' | 'installing' | 'ready' | 'error';

function mb(bytes?: number): string {
  return bytes && bytes > 0 ? `${Math.round(bytes / 1048576)} MB` : '';
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// Checks GitHub releases on launch. Android always shows the installer, so
// the best this can do is download silently and hand the APK over.
export default function UpdateDialog() {
  const t = useTheme();
  const current = installedVersion();
  const [phase, setPhase] = useState<Phase>('idle');
  const [manifest, setManifest] = useState<UpdateManifest | null>(null);
  const [progress, setProgress] = useState<UpdateProgress>({ written: 0, total: 0 });
  const [error, setError] = useState('');
  const fileRef = useRef<Awaited<ReturnType<typeof downloadUpdate>> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // A debug build carries the debug signature; it would offer a release APK
    // Android then refuses to install. Only release builds check.
    if (__DEV__) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      void checkForUpdate(ctrl.signal)
        .then((m) => {
          if (!m) return;
          setManifest(m);
          setPhase('available');
        })
        .catch(() => {
          // Offline or GitHub unreachable: stay quiet; the site is the fallback.
        });
    }, 2000);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, []);

  async function downloadAndInstall() {
    if (!manifest) return;
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
      await install();
    } catch (e) {
      if (ctrl.signal.aborted) {
        setPhase('available');
        return;
      }
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
    setPhase('installing');
    try {
      await installDownloaded(file);
      // The app survives only if the user backed out of the installer.
      setPhase('ready');
    } catch (e) {
      setError(errText(e));
      setPhase('error');
    }
  }

  function close() {
    abortRef.current?.abort();
    setPhase('idle');
  }

  const open = phase !== 'idle';
  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.written / progress.total) * 100)) : 0;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <YStack
        flex={1}
        backgroundColor="rgba(0,0,0,0.6)"
        alignItems="center"
        justifyContent="center"
        padding="$5"
      >
        <YStack
          backgroundColor={t.panel}
          borderWidth={1}
          borderColor={t.lineStrong}
          borderRadius={0}
          padding="$4"
          gap="$3"
          width="100%"
          maxWidth={360}
        >
          {phase === 'available' && manifest ? (
            <>
              <Text fontSize={19} fontWeight="700">
                Update available
              </Text>
              <Text fontSize={15} color="$color10">
                PhoneCanDo {current.version} → {manifest.version}
                {manifest.size ? ` · ${mb(manifest.size)}` : ''}
              </Text>
              {manifest.notes ? (
                <Text fontSize={14} color="$color10">
                  {manifest.notes}
                </Text>
              ) : null}
              <Text fontSize={13} color="$color10">
                Android will ask you to confirm the install. Your data is kept.
              </Text>
              <XStack gap="$2" marginTop="$2">
                <AppButton variant="secondary" flex={1} onPress={close}>
                  Later
                </AppButton>
                <AppButton flex={1} onPress={() => void downloadAndInstall()}>
                  Update
                </AppButton>
              </XStack>
            </>
          ) : null}

          {phase === 'downloading' ? (
            <>
              <Text fontSize={19} fontWeight="700">
                Downloading update
              </Text>
              <Text fontSize={15} color="$color10">
                {pct}%{progress.total > 0 ? ` · ${mb(progress.written)} of ${mb(progress.total)}` : ''}
              </Text>
              <YStack height={6} backgroundColor={t.line} width="100%">
                <YStack height={6} backgroundColor={t.primary} width={`${pct}%`} />
              </YStack>
              <Text fontSize={13} color="$color10">
                Keep the app open. The update installs when the download finishes.
              </Text>
              <XStack gap="$2" marginTop="$2">
                <AppButton variant="secondary" flex={1} onPress={close}>
                  Cancel
                </AppButton>
              </XStack>
            </>
          ) : null}

          {phase === 'installing' ? (
            <>
              <Text fontSize={19} fontWeight="700">
                Opening installer
              </Text>
              <Text fontSize={15} color="$color10">
                Confirm the install in Android's dialog. PhoneCanDo will close and reopen on the new
                version.
              </Text>
            </>
          ) : null}

          {phase === 'ready' ? (
            <>
              <Text fontSize={19} fontWeight="700">
                Ready to install
              </Text>
              <Text fontSize={15} color="$color10">
                The update is downloaded. If you dismissed Android's installer, install it again
                below.
              </Text>
              <XStack gap="$2" marginTop="$2">
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
                Update failed
              </Text>
              <Text fontSize={15} color="$color10">
                {error}
              </Text>
              <AppButton variant="secondary" onPress={() => void openInstallSettings()}>
                Open install settings
              </AppButton>
              <XStack gap="$2" marginTop="$2">
                <AppButton variant="secondary" flex={1} onPress={close}>
                  Close
                </AppButton>
                <AppButton flex={1} onPress={() => void downloadAndInstall()}>
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
