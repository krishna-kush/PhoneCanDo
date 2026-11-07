import { useState } from 'react';
import { Text, XStack } from 'tamagui';
import type { Agent } from '../../../engine/agents/records';
import type { Image } from '../../../engine/linux/types';
import { useAgentsStore } from '../../../state/agents';
import { useAppStore } from '../../../state/app';
import AppButton from '../../common/AppButton';
import SectionTitle from '../../common/SectionTitle';
import EngineDot from '../../common/agent-switcher/EngineDot';
import { useTheme } from '../../common/globals';
import { engineIsUp, engineStateWord } from '../logic/engineState';
import { startErrorText, startFailureCode } from '../logic/errorText';
import Note from '../parts/Note';

type Props = { agent: Agent; image: Image | undefined; linux: boolean };

// The agent's engine (state, Start/Stop) and the ways into it: chat, the
// terminal UI, and a shell in its machine. All need the machine ready.
export default function EngineSection({ agent, image, linux }: Props) {
  const t = useTheme();
  const status = useAgentsStore((s) => s.statuses[agent.id]);
  const startAgent = useAgentsStore((s) => s.startAgent);
  const stopAgent = useAgentsStore((s) => s.stopAgent);
  const setActiveAgent = useAgentsStore((s) => s.setActiveAgent);
  const setFooterTab = useAppStore((s) => s.setFooterTab);
  const setFolderPickerOpen = useAppStore((s) => s.setFolderPickerOpen);
  const openLinuxTerminal = useAppStore((s) => s.openLinuxTerminal);
  const [busy, setBusy] = useState<'start' | 'stop' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const up = engineIsUp(status?.state);
  const ready = image?.state === 'ready';

  const start = () => {
    setBusy('start');
    setError(null);
    startAgent(agent.id)
      .then((res) => {
        if (res.status === 'unavailable') setError("This build can't run agents.");
        const code = startFailureCode(res.status);
        if (code) setError(startErrorText(code));
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
      <SectionTitle>Agent</SectionTitle>
      <XStack alignItems="center" gap="$2">
        <EngineDot state={status?.state} size={10} />
        <Text fontSize={16} fontWeight="600">
          {engineStateWord(status?.state)}
        </Text>
        {status?.port && up ? (
          <Text fontFamily="$mono" fontSize={12} color={t.dim}>
            {`port ${status.port}`}
          </Text>
        ) : null}
      </XStack>
      {error ? <Note tone="error">{error}</Note> : null}
      {!error && status?.error && (status.state === 'failed' || status.state === 'died') ? (
        <Text fontFamily="$mono" fontSize={12} color={t.dim} selectable>
          {status.error}
        </Text>
      ) : null}
      {!ready ? <Note>It can start once its machine is ready.</Note> : null}
      {up ? (
        <AppButton variant="secondary" loading={busy === 'stop'} onPress={stop}>
          Stop
        </AppButton>
      ) : (
        <AppButton loading={busy === 'start'} disabled={!ready} onPress={start}>
          Start
        </AppButton>
      )}
      <XStack gap="$2">
        <AppButton flex={1} variant="secondary" disabled={!ready} onPress={() => follow(() => setFooterTab('home'))}>
          Open chat
        </AppButton>
        <AppButton
          flex={1}
          variant="secondary"
          disabled={!ready}
          onPress={() => follow(() => setFolderPickerOpen(true))}
        >
          Open TUI
        </AppButton>
      </XStack>
      <AppButton variant="secondary" disabled={!ready} onPress={() => openLinuxTerminal(agent.id)}>
        {linux ? 'Open terminal in the machine' : 'Open terminal'}
      </AppButton>
    </>
  );
}
