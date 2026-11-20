import type { AgentId } from '../../../engine/agents/records';
import { useAppStore } from '../../../state/app';
import ActionDeck from '../../common/actions/ActionDeck';
import Note from '../parts/Note';
import { typedCommandNote } from './logic/copy';

type Props = {
  /** Whose terminal; null on a machine no agent uses (no terminal there). */
  agentId: AgentId | null;
  /** An agent on it whose kind installs into the machine, whose install log the key opens; null: none does, no key. */
  logAgentId: AgentId | null;
  linux: boolean;
  /** The machine is ready: a terminal, a check and a command can run. */
  ready: boolean;
  /** The line that installs the tools its agents need; null when none are missing or it can't. */
  installCommand: string | null;
  /** The line that updates every package; null without a package manager we know. */
  upgradeCommand: string | null;
  /** Check again is measuring or reading. */
  checking: boolean;
  onCheck: () => void;
};

// The machine page's Controls: a shell in it, its agents' missing tools
// and a full package update (each typed into a terminal, not run), Check
// again (size, Inside and tools), the last install log (when an agent on
// it has a kind that installs into the machine; a built-in one never
// does). A machine no agent uses has no terminal.
export default function MachineControls(p: Props) {
  const push = useAppStore((s) => s.push);
  const openLinuxTerminal = useAppStore((s) => s.openLinuxTerminal);
  const { agentId, logAgentId } = p;
  const install = agentId != null && p.ready ? p.installCommand : null;
  const upgrade = agentId != null && p.ready && p.linux ? p.upgradeCommand : null;
  const typed = typedCommandNote(install != null, upgrade != null);

  return (
    <>
      <ActionDeck
        barcode="deckMachine"
        actions={[
          agentId != null && { label: 'Open terminal', role: 'go', mark: 'terminal', disabled: !p.ready, onPress: () => openLinuxTerminal(agentId) },
          agentId != null && install != null && { label: 'Install tools', onPress: () => openLinuxTerminal(agentId, install) },
          agentId != null && upgrade != null && { label: 'Update system', onPress: () => openLinuxTerminal(agentId, upgrade) },
          p.linux && { label: 'Check again', loading: p.checking, disabled: !p.ready, onPress: p.onCheck },
          logAgentId != null && p.linux && { label: 'Install log', onPress: () => push({ name: 'agent-install-log', agentId: logAgentId }) },
        ]}
      />
      {typed ? <Note>{typed}</Note> : null}
    </>
  );
}
