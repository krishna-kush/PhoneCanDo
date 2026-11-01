import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAppStore, type ThemeMode } from '../../state/app';
import * as runner from '../../engine/runner';
import { installedVersion } from '../../engine/updates';
import AppButton from '../common/AppButton';
import AppCard from '../common/AppCard';
import ConfirmDialog from '../common/ConfirmDialog';
import Screen from '../common/Screen';
import SectionTitle from '../common/SectionTitle';
import LogoMark from '../common/LogoMark';
import ThumbIcon from '../common/ThumbIcon';
import { TUI, useScheme } from '../common/globals';

const runnerAvailable = runner.isRunnerAvailable();
const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

function Thumb({ up }: { up: boolean }) {
  return <ThumbIcon up={up} size={26} />;
}

export default function SettingsScreen() {
  const scheme = useScheme();
  const [engineStatus, setEngineStatus] = useState('unknown');
  const [engineLog, setEngineLog] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [uiConnected, setUiConnected] = useState(false);
  const [trustMsg, setTrustMsg] = useState('');
  const enginePort = useAppStore((s) => s.enginePort);
  const footerTab = useAppStore((s) => s.footerTab);
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const resetWorkspace = useAppStore((s) => s.resetWorkspace);
  const [confirmReset, setConfirmReset] = useState(false);
  const version = installedVersion();
  // Build flavor (full ships the automation driver, play compiles it out).
  // Sync native call; pre-flag installs and Expo Go read as full.
  let automation = 'full';
  try {
    if (runnerAvailable) automation = runner.isAutomationBuild();
  } catch {
    // native bridge absent
  }

  useEffect(() => {
    if (!runnerAvailable) return;
    const sync = () => {
      setUnlocked(runner.isAutomationEnabled());
      setUiConnected(runner.isUiAutomationConnected());
    };
    sync();
    // Users toggle the service in Android Settings, so re-read on return.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => sub.remove();
  }, []);

  // The in-chat unlock modal can flip the gate while Settings stays mounted;
  // refresh when the tab becomes visible.
  useEffect(() => {
    if (!runnerAvailable || footerTab !== 'settings') return;
    setUnlocked(runner.isAutomationEnabled());
    setUiConnected(runner.isUiAutomationConnected());
  }, [footerTab]);

  async function refresh() {
    if (!runnerAvailable) {
      setEngineStatus('native module unavailable');
      return;
    }
    setUnlocked(runner.isAutomationEnabled());
    setUiConnected(runner.isUiAutomationConnected());
    try {
      const health = runner.serveHealth(enginePort);
      setEngineStatus(health === 'ok' ? 'running (ok)' : `stopped (${health})`);
    } catch (e) {
      setEngineStatus(`error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function start() {
    if (!runnerAvailable) return;
    try {
      const res = runner.startServeService({ port: enginePort });
      setEngineLog(res);
      setTimeout(refresh, 4000);
    } catch (e) {
      setEngineLog(`start failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function stop() {
    if (!runnerAvailable) return;
    try {
      setEngineLog(runner.stopServeService());
      setEngineStatus('stopped');
    } catch (e) {
      setEngineLog(`stop failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function togglePhoneControl() {
    if (!runnerAvailable) return;
    if (unlocked) {
      runner.setAutomationEnabled(false);
      setUnlocked(false);
      setTrustMsg('Phone control locked.');
      return;
    }
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock phone control',
        cancelLabel: 'Cancel',
      });
      if (!res.success) {
        setTrustMsg('Not unlocked.');
        return;
      }
      const ok = runner.setAutomationEnabled(true);
      setUnlocked(ok);
      setUiConnected(runner.isUiAutomationConnected());
      setTrustMsg(ok ? 'Unlocked until you lock it or PhoneCanDo restarts.' : 'This install has no phone-control driver; rebuild the app.');
    } catch (e) {
      setTrustMsg(`Biometric error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <Screen>
      <SectionTitle>About</SectionTitle>
      <AppCard
        title="PhoneCanDo on-device agent"
        subtitle={`v${version.version} (${version.versionCode}) · theme ${scheme} · automation ${automation}`}
        chevron={false}
        icon={<LogoMark size={36} />}
        plate={false}
      />

      <SectionTitle>Appearance</SectionTitle>
      <XStack gap="$2">
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

      <SectionTitle>Phone control</SectionTitle>
      {automation === 'play' ? (
        <Text fontSize={14} color="$color10">
          This Play build has no screen automation. Notifications, clipboard, and opening links still work.
        </Text>
      ) : (
        <>
          <AppCard
            title={unlocked ? 'Unlocked' : 'Locked'}
            subtitle={
              unlocked
                ? 'The agent can act on the phone until you lock it or PhoneCanDo restarts.'
                : 'Biometric unlock is required before the agent can act on the phone.'
            }
            chevron={false}
            icon={<Thumb up={unlocked} />}
          />
          <AppCard
            title={uiConnected ? 'Accessibility service: on' : 'Accessibility service: off'}
            subtitle="Android Settings → Accessibility → PhoneCanDo"
            chevron={false}
            icon={<Thumb up={uiConnected} />}
          />
          <AppButton onPress={togglePhoneControl}>
            {unlocked ? 'Lock phone control' : 'Unlock with biometrics'}
          </AppButton>
          <AppButton variant="secondary" onPress={() => runner.openAccessibilitySettings()}>
            Open accessibility settings
          </AppButton>
          {trustMsg ? (
            <Text fontSize={13} color="$color10">
              {trustMsg}
            </Text>
          ) : null}
          <Text fontSize={14} color="$color10">
            Uses Android's Accessibility API to read the screen and tap, type, scroll, notify,
            and use the clipboard. Off by default; the agent cannot unlock it.
          </Text>
        </>
      )}

      <SectionTitle>Engine (on-device serve)</SectionTitle>
      <AppCard
        title={`Status: ${engineStatus}`}
        subtitle="Foreground service on 127.0.0.1"
        chevron={false}
        icon={<Thumb up={engineStatus.startsWith('running')} />}
      />
      {engineLog ? (
        <YStack
          borderWidth={1}
          borderColor={TUI.line}
          borderRadius={0}
          padding="$3"
          backgroundColor={TUI.bg}
        >
          <Text fontFamily="$mono" fontSize={13} color={TUI.fg} selectable>
            {engineLog}
          </Text>
        </YStack>
      ) : null}
      <AppButton variant="secondary" onPress={refresh}>
        Refresh status
      </AppButton>
      <AppButton onPress={start}>Start engine</AppButton>
      <AppButton variant="secondary" onPress={stop}>
        Stop engine
      </AppButton>
      <Text fontSize={14} color="$color10">
        Starts on app launch and chat open; stops when the app is closed and nothing runs.
      </Text>

      <SectionTitle>Reset</SectionTitle>
      <Text fontSize={14} color="$color10">
        Resets envs to default, wipes the engine database (sessions and server
        projects), and restarts fresh. Working directories are kept.
      </Text>
      <AppButton variant="danger" onPress={() => setConfirmReset(true)}>
        Reset everything
      </AppButton>
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset everything?"
        message="Resets envs, wipes the engine database, and restarts the engine. This cannot be undone."
        confirmLabel="Reset"
        onConfirm={() => {
          setConfirmReset(false);
          void resetWorkspace().then((msg) => {
            setEngineLog(msg);
            setTimeout(refresh, 2000);
          });
        }}
      />
    </Screen>
  );
}
