import { useState } from 'react';
import { XStack } from 'tamagui';
import type { Agent } from '../../../engine/agents/records';
import { agentKind, kindShipped } from '../../../engine/agents/registry';
import type { Image } from '../../../engine/linux/types';
import { useAgentsStore } from '../../../state/agents';
import { useAppStore } from '../../../state/app';
import { walkDare } from '../../../state/starter';
import ActionDeck from '../../common/actions/ActionDeck';
import { moodLine } from '../../common/face/lines';
import { moodOf } from '../../common/face/mood';
import PlainText from '../../common/PlainText';
import { engineIsUp, engineStateWord } from '../logic/engineState';
import { startFailureCode, startFailureText } from '../logic/errorText';
import { kindGoneText } from '../logic/kindGone';
import Note from '../parts/Note';

type Props = { agent: Agent; image: Image | undefined; linux: boolean };

// The agent's engine (state in words, Start/Stop) and the ways into it:
// chat and the terminal UI (a web-home kind), or its own TUI on Home (a
// tui-home kind, which has no client to attach), and a shell in its
// machine. All need the machine ready; all but the shell need the agent
// installed in it (a kind with an install, see InstallSection). An agent
// whose kind this build no longer ships keeps only the shell (and Stop,
// should it still run), says why and offers the custom agent form, to add
// it back as your own.
export default function EngineSection({ agent, image, linux }: Props) {
  const status = useAgentsStore((s) => s.statuses[agent.id]);
  const startAgent = useAgentsStore((s) => s.startAgent);
  const stopAgent = useAgentsStore((s) => s.stopAgent);
  const setActiveAgent = useAgentsStore((s) => s.setActiveAgent);
  const goHome = useAppStore((s) => s.goHome);
  const push = useAppStore((s) => s.push);
  const openFolderPicker = useAppStore((s) => s.openFolderPicker);
  const openLinuxTerminal = useAppStore((s) => s.openLinuxTerminal);
  const [busy, setBusy] = useState<'start' | 'stop' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const up = engineIsUp(status?.state);
  const machineReady = image?.state === 'ready';
  const ready = machineReady && !agent.needsInstall;
  const kind = agentKind(agent.kind);
  const shipped = kindShipped(agent.kind);

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
        <PlainText fontSize={16} fontWeight="600">
          {engineStateWord(status?.state)}
        </PlainText>
        <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} color="dim" textTransform="uppercase">
          {status?.port && up ? `port ${status.port} · ${moodLine(moodOf(status.state))}` : moodLine(moodOf(status?.state))}
        </PlainText>
      </XStack>
      {error ? <Note tone="error">{error}</Note> : null}
      {!error && status?.error && (status.state === 'failed' || status.state === 'died') ? (
        <PlainText fontFamily="mono" fontSize={12} color="dim" userSelect="text">
          {status.error}
        </PlainText>
      ) : null}
      {!shipped ? <Note>{kindGoneText(agent.kind)}</Note> : null}
      {shipped && !machineReady ? <Note>It can start once its machine is ready.</Note> : null}
      {shipped && machineReady && !ready ? <Note>It can start once it's installed.</Note> : null}
      {/* The first shift's terminal walk leads to Open terminal, maybe with a command to type in. */}
      <ActionDeck
        barcode="deckEngine"
        actions={[
          shipped && !up && { label: 'Start', role: 'go', mark: 'play', loading: busy === 'start', disabled: !ready, onPress: start },
          !shipped
            ? { label: 'Add it as a custom agent', role: 'go', mark: 'add', onPress: () => push({ name: 'custom-agent', kindId: null }) }
            : kind.home === 'tui'
              ? { label: `Open ${kind.label} home`, disabled: !ready, onPress: () => follow(goHome) }
              : { label: 'Open chat', disabled: !ready, onPress: () => follow(goHome) },
          shipped && kind.home !== 'tui' && { label: 'Open TUI', disabled: !ready, onPress: () => follow(openFolderPicker) },
          {
            label: linux ? 'Open terminal in the machine' : 'Open terminal',
            disabled: !machineReady,
            onPress: () => openLinuxTerminal(agent.id, walkDare('terminal')),
            spot: 'agent.terminal',
          },
          up && { label: 'Stop', loading: busy === 'stop', onPress: stop },
        ]}
      />
    </>
  );
}
