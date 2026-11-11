import { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { YStack } from 'tamagui';
import type { Agent } from '../../../engine/agents/records';
import { agentKind } from '../../../engine/agents/registry';
import { track } from '../../../engine/telemetry';
import { useHomeInFront } from '../../nav/homeInFront';
import TerminalView from '../../terminal/TerminalView';
import { engineTransport } from '../../terminal/transport/engine';
import { useOpenTuiChat } from '../../terminal/useOpenTuiChat';
import TuiHomeNotice from './TuiHomeNotice';
import { useTuiEngine } from './useTuiEngine';

// Home of an agent whose kind's home is its TUI (KindView home 'tui'): the
// engine runs the program in a PTY the runner's service owns, and this view
// attaches to it as its one viewer. The program keeps running when a page
// over Home, a terminal or the app goes away; coming back attaches again and
// the replay restores its screen. A program that ends while shown keeps
// its last screen on view, read-only, under the stopped notice: it often
// says why it stopped. HomeScreen mounts one per active agent. Nothing else
// opens this PTY: the header offers a shell in the machine.
export default function AgentTuiHome({ agent }: { agent: Agent }) {
  const kind = agentKind(agent.kind);
  const { phase, run, restart, onEnd } = useTuiEngine(agent.id);
  // In front: Home with no page over it.
  const inFront = useHomeInFront();
  const attached = phase.name === 'attached';
  // Nothing takes input once the program is gone: its keyboard goes too
  // (the terminal's own blur covers a screen kept on view; not one that
  // unmounted while focused).
  const inFrontRef = useRef(inFront);
  inFrontRef.current = inFront;
  useEffect(() => {
    if (!attached && inFrontRef.current) Keyboard.dismiss();
  }, [attached]);
  // What the program titles its terminal: an agent TUI names its chat there.
  const [termTitle, setTermTitle] = useState('');
  useOpenTuiChat(attached && inFront ? agent.id : null, termTitle);

  // One per attach, like the web home's pairing. A title belongs to the
  // program that set it.
  useEffect(() => {
    if (attached) track('chat.open');
    else setTermTitle('');
  }, [attached, run]);

  const lastScreen = phase.name === 'stopped' && phase.screen;
  if (!attached && !lastScreen) return <TuiHomeNotice label={kind.label} phase={phase} onRestart={restart} />;
  return (
    <YStack flex={1}>
      <TerminalView
        key={run}
        transport={() => engineTransport(agent.id)}
        active={attached && inFront}
        name={kind.label}
        onTitle={setTermTitle}
        onEnd={onEnd}
      />
      {phase.name !== 'attached' ? <TuiHomeNotice label={kind.label} phase={phase} onRestart={restart} /> : null}
    </YStack>
  );
}
