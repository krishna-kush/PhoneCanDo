import { useState } from 'react';
import { Text, XStack } from 'tamagui';
import type { Agent } from '../../../engine/agents/records';
import { agentKind } from '../../../engine/agents/registry';
import type { Image } from '../../../engine/linux/types';
import { useAgentsStore } from '../../../state/agents';
import { useAppStore } from '../../../state/app';
import AppButton from '../../common/AppButton';
import { moodLine } from '../../common/face/lines';
import { moodOf } from '../../common/face/mood';
import { useTheme } from '../../common/globals';
import { engineIsUp, engineStateWord } from '../logic/engineState';
import { startFailureCode, startFailureText } from '../logic/errorText';
import Note from '../parts/Note';

type Props = { agent: Agent; image: Image | undefined; linux: boolean };

// The agent's engine (state in words, Start/Stop) and the ways into it:
// chat and the terminal UI (a web-home kind), or its own TUI on Home (a
// tui-home kind, which has no client to attach), and a shell in its
// machine. All need the machine ready; all but the shell need the agent
// installed in it (a kind with an install, see InstallSection).
export default function EngineSection({ agent, image, linux }: Props) {
  const t = useTheme();
  const status = useAgentsStore((s) => s.statuses[agent.id]);
  const startAgent = useAgentsStore((s) => s.startAgent);
  const stopAgent = useAgentsStore((s) => s.stopAgent);
  const setActiveAgent = useAgentsStore((s) => s.setActiveAgent);
  const goHome = useAppStore((s) => s.goHome);
  const openFolderPicker = useAppStore((s) => s.openFolderPicker);
  const openLinuxTerminal = useAppStore((s) => s.openLinuxTerminal);
  const [busy, setBusy] = useState<'start' | 'stop' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const up = engineIsUp(status?.state);
  const machineReady = image?.state === 'ready';
  const ready = machineReady && !agent.needsInstall;
  const kind = agentKind(agent.kind);

  const start = () => {
    setBusy('start');
    setError(null);
    startAgent(agent.id)
      .then((res) => {
        if (res.status === 'unavailable') setError("This build can't run agents.");
        const code = startFailureCode(res.status);
        if (code) setError(startFailureText(code, res.error));
      })
      .finally(() => setBusy(null));
  };

  const stop = () => {
    setBusy('stop');
    setError(null);
    stopAgent(agent.id).finally(() => setBusy(null));
  };

  // Chat and the terminal UI follow the active agent, so this one becomes it first.
  const follow = (then: () => void) => {
    void setActiveAgent(agent.id).then(then);
  };

  return (
    <>
      <XStack alignItems="baseline" gap="2" flexWrap="wrap">
        <Text fontSize={16} fontWeight="600">
          {engineStateWord(status?.state)}
        </Text>
        <Text fontFamily="mono" fontSize={11} letterSpacing={1.2} color={t.dim} textTransform="uppercase">
          {status?.port && up ? `port ${status.port} · ${moodLine(moodOf(status.state))}` : moodLine(moodOf(status?.state))}
        </Text>
      </XStack>
      {error ? <Note tone="error">{error}</Note> : null}
      {!error && status?.error && (status.state === 'failed' || status.state === 'died') ? (
        <Text fontFamily="mono" fontSize={12} color={t.dim} userSelect="text">
          {status.error}
        </Text>
      ) : null}
      {!machineReady ? <Note>It can start once its machine is ready.</Note> : null}
      {machineReady && !ready ? <Note>It can start once it's installed.</Note> : null}
      {up ? (
        <AppButton variant="secondary" loading={busy === 'stop'} onPress={stop}>
          Stop
        </AppButton>
      ) : (
        <AppButton loading={busy === 'start'} disabled={!ready} onPress={start}>
          Start
        </AppButton>
      )}
      {kind.home === 'tui' ? (
        <AppButton variant="secondary" disabled={!ready} onPress={() => follow(goHome)}>
          {`Open ${kind.label} home`}
        </AppButton>
      ) : (
        <XStack gap="2">
          <AppButton flex={1} variant="secondary" disabled={!ready} onPress={() => follow(goHome)}>
            Open chat
          </AppButton>
          <AppButton
            flex={1}
            variant="secondary"
            disabled={!ready}
            onPress={() => follow(openFolderPicker)}
          >
            Open TUI
          </AppButton>
        </XStack>
      )}
      <AppButton variant="secondary" disabled={!machineReady} onPress={() => openLinuxTerminal(agent.id)}>
        {linux ? 'Open terminal in the machine' : 'Open terminal'}
      </AppButton>
    </>
  );
}
