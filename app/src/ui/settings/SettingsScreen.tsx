import { useState } from 'react';
import { Text, XStack, YStack } from 'tamagui';
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
import PhoneControlSection from './PhoneControlSection';
import PrivacySection from './PrivacySection';

const runnerAvailable = runner.isRunnerAvailable();
const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

function Thumb({ up }: { up: boolean }) {
  return <ThumbIcon up={up} size={26} />;
}

export default function SettingsScreen() {
  const scheme = useScheme();
  const [engineStatus, setEngineStatus] = useState('unknown');
  const [engineLog, setEngineLog] = useState('');
  const enginePort = useAppStore((s) => s.enginePort);

  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const resetWorkspace = useAppStore((s) => s.resetWorkspace);
  const requestUpdatePrompt = useAppStore((s) => s.requestUpdatePrompt);
  const updatePromptMuted = useAppStore((s) => s.updatePromptMuted);
  const setUpdatePromptMuted = useAppStore((s) => s.setUpdatePromptMuted);
  const [confirmReset, setConfirmReset] = useState(false);
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

  async function refresh() {
    if (!runnerAvailable) {
      setEngineStatus('native module unavailable');
      return;
    }
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

  return (
    <Screen>
      <SectionTitle>About</SectionTitle>
      <AppCard
        title="PhoneCanDo on-device agent"
        subtitle={`v${version.version} (${version.versionCode}) · theme ${scheme} · channel ${channel}`}
        chevron={false}
        icon={<LogoMark size={36} />}
        plate={false}
        onLongPress={() => setShowTester((v) => !v)}
      />

      {/* Lite has no phone control; saying so belongs next to what the build is. */}
      {channel === 'lite' ? <PhoneControlSection channel={channel} /> : null}

      <SectionTitle>Update</SectionTitle>
      {channel === 'lite' ? (
        <>
          <AppCard
            title="Starter build: a brain in a jar"
            subtitle="Chat and terminal only. No eyes, no hands."
            chevron={false}
            icon={<Thumb up={false} />}
          />
          <Text fontSize={14} color="$color10">
            Right now the agent can think but not act. It cannot see your screen, tap a button or
            type a word, so every "open WhatsApp and reply" ends in a polite shrug. The full build
            fixes that in one tap: it installs over this one, keeps your data, and gives the agent
            eyes and hands behind your fingerprint.
          </Text>
          <AppButton onPress={requestUpdatePrompt}>Install the full build</AppButton>
          <AppButton
            variant="secondary"
            onPress={() => void setUpdatePromptMuted(!updatePromptMuted)}
          >
            {updatePromptMuted ? 'Ask again on launch' : "Don't ask on launch"}
          </AppButton>
          <Text fontSize={13} color="$color10">
            {updatePromptMuted
              ? 'The full-build offer stays quiet at launch. This button brings it back.'
              : 'The full-build offer opens every launch until you install it or silence it here.'}
          </Text>
        </>
      ) : (
        <>
          <AppCard
            title={channel === 'play' ? 'Updates come through Play' : 'Full build'}
            subtitle={
              channel === 'play'
                ? `v${version.version} · Play keeps it current`
                : `v${version.version} · checks GitHub on launch`
            }
            chevron={false}
            icon={<Thumb up />}
          />
          {channel !== 'play' ? (
            <AppButton variant="secondary" onPress={requestUpdatePrompt}>
              Check for updates
            </AppButton>
          ) : null}
        </>
      )}

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

      {channel !== 'lite' ? <PhoneControlSection channel={channel} /> : null}

      <PrivacySection showTester={showTester} />

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
