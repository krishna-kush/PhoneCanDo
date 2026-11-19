import type { Agent } from '../../../engine/agents/records';
import type { ReinstallList } from '../../../engine/linux/types';
import { useAppStore } from '../../../state/app';
import { installAgent } from '../../../state/flows/installAgent';
import { forgetAgentReinstall } from '../../../state/flows/installRuns';
import { forgetReinstall } from '../../../state/flows/resetAgentImage';
import ActionDeck from '../../common/actions/ActionDeck';
import { agentReinstallLine, reinstallLine } from '../logic/hints';
import Note from '../parts/Note';

type Props = {
  agent: Agent;
  imageId: string;
  /** What the user had installed by hand; null when nothing. */
  offer: ReinstallList | null;
  /** The agent was installed and the reset took the system packages it needs. */
  agentReinstall: boolean;
  /** The hand-installed part is used or dismissed. */
  onDone: () => void;
};

// After a reset: "Reinstall <agent>" for an installed agent of a kind with
// an install (its install runs again; the Install section shows it), and
// what the user had installed by hand, with a terminal that has the one line
// that installs it all again, typed in but not run. Each button ends its own
// part; Dismiss ends both.
export default function ReinstallOffer({ agent, imageId, offer, agentReinstall, onDone }: Props) {
  const openLinuxTerminal = useAppStore((s) => s.openLinuxTerminal);

  const forgetPackages = () => {
    if (!offer) return;
    forgetReinstall(imageId);
    onDone();
  };

  return (
    <>
      {agentReinstall ? <Note>{agentReinstallLine(agent.name)}</Note> : null}
      {offer ? <Note>{reinstallLine(offer.packages)}</Note> : null}
      <ActionDeck
        barcode="deckReinstall"
        actions={[
          agentReinstall && {
            label: `Reinstall ${agent.name}`,
            role: 'go',
            onPress: () => {
              forgetAgentReinstall(agent.id);
              void installAgent(agent.id);
            },
          },
          offer && {
            label: 'Open terminal with the install command',
            onPress: () => {
              forgetPackages();
              openLinuxTerminal(agent.id, offer.installCommand);
            },
          },
          {
            label: 'Dismiss',
            role: 'back',
            onPress: () => {
              forgetAgentReinstall(agent.id);
              forgetPackages();
            },
          },
        ]}
      />
    </>
  );
}
