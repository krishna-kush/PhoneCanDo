import { useEffect, useState } from 'react';
import TerminalView from './TerminalView';
import { sessionRecipe } from './sessionRecipe';
import { localTransport } from './transport/local';
import { useOpenTuiChat } from './useOpenTuiChat';
import type { TerminalSession } from '../../state/app';
import { track } from '../../engine/telemetry';

// One terminal session (its page is keyed by session id): the agent's TUI
// client or a shell in its Linux image, each on a PTY of its own that
// closes with the screen. Only the recipe differs; TerminalView does input,
// sizing and rendering for both. `active`: its page is the one in front.
export default function TerminalScreen({ session, active }: { session: TerminalSession; active: boolean }) {
  // What the program titles its terminal: an agent TUI names its chat there.
  const [termTitle, setTermTitle] = useState('');
  useOpenTuiChat(session.kind === 'tui' ? session.agentId : null, termTitle);

  // One per terminal opened (the screen is keyed by session).
  useEffect(() => {
    track('terminal.open');
  }, []);

  return (
    <TerminalView
      transport={() => localTransport(() => sessionRecipe(session))}
      active={active}
      name={session.kind === 'linux' ? 'sh' : 'tui'}
      initialInput={session.kind === 'linux' ? session.initialInput : undefined}
      onTitle={setTermTitle}
    />
  );
}
