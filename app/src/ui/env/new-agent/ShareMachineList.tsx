import { useMemo, useState } from 'react';
import { YStack } from 'tamagui';
import type { Agent } from '../../../engine/agents/records';
import { agentKind } from '../../../engine/agents/registry';
import type { ImageId } from '../../../engine/linux/types';
import { useAgentsStore } from '../../../state/agents';
import { shareBlockFor } from '../../../state/flows/kindOffers';
import type { AgentPick } from '../../../state/flows/logic/modelStep';
import { nextAgentName } from '../../../state/flows/logic/names';
import { useKindsStore } from '../../../state/kinds';
import AppCard from '../../common/AppCard';
import ConfirmDialog from '../../common/ConfirmDialog';
import SectionTitle from '../../common/SectionTitle';
import SystemLogo from '../list/SystemLogo';
import { shareBlockText, type ShareChoice } from '../logic/shareChoices';
import { shareMessage, shareTitle } from '../logic/sharedMachineText';

type Props = {
  pick: AgentPick;
  choices: ShareChoice<Agent>[];
  /** A new agent is being made: taps wait. */
  busy: boolean;
  onShare: (imageId: ImageId) => void;
};

// New agent's Where does it run?, Share a machine: the machines agents
// already use (logic/shareChoices.ts), each titled by its agents and showing
// its system's logo. One the picked agent can't join is dimmed and says why.
// A tap asks first: the confirm says what sharing means and recommends its
// own machine (that button closes it, back to the systems above); Share
// makes the agent there.
export default function ShareMachineList({ pick, choices, busy, onShare }: Props) {
  const agents = useAgentsStore((s) => s.agents);
  const kindsVersion = useKindsStore((s) => s.version);
  const [asking, setAsking] = useState<ShareChoice<Agent> | null>(null);
  const label = agentKind(pick.kindId).label;

  // kindsVersion: a kind changed, so judge again.
  const blockedOf = useMemo(
    () => (choice: ShareChoice<Agent>) => shareBlockText(shareBlockFor(choice, pick.kindId), label),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pick.kindId, label, kindsVersion],
  );

  const names = asking ? asking.agents.map((a) => a.name) : [];
  const ask = (choice: ShareChoice<Agent>) => {
    if (!busy) setAsking(choice);
  };
  const share = () => {
    const choice = asking;
    setAsking(null);
    if (choice) onShare(choice.imageId);
  };

  return (
    <>
      <SectionTitle>Share a machine</SectionTitle>
      {choices.map((choice) => {
        const blocked = blockedOf(choice);
        return (
          <YStack key={choice.key} opacity={blocked ? 0.5 : 1}>
            <AppCard
              title={choice.title}
              subtitle={blocked ?? choice.subtitle}
              icon={
                choice.logoKeys.length > 0 ? (
                  <SystemLogo keys={choice.logoKeys} letter={choice.system.charAt(0).toUpperCase()} size={32} />
                ) : undefined
              }
              onPress={blocked ? undefined : () => ask(choice)}
              chevron={!blocked}
            />
          </YStack>
        );
      })}
      <ConfirmDialog
        open={asking != null}
        onClose={() => setAsking(null)}
        title={shareTitle(names)}
        message={shareMessage(nextAgentName(label, agents.map((a) => a.name)), names)}
        cancelLabel="Its own machine (recommended)"
        confirmLabel="Share"
        onConfirm={share}
      />
    </>
  );
}
