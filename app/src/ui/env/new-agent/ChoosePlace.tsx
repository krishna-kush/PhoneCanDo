import { useMemo } from 'react';
import { YStack } from 'tamagui';
import { agentKind } from '../../../engine/agents/registry';
import { useAppStore } from '../../../state/app';
import { offersForEnv } from '../../../state/flows/kindOffers';
import type { AgentPick } from '../../../state/flows/logic/modelStep';
import { useKindsStore } from '../../../state/kinds';
import { useLinuxStore } from '../../../state/linux';
import AppCard from '../../common/AppCard';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import Stamp from '../../common/Stamp';
import SystemLogo from '../list/SystemLogo';
import { blockedText } from '../logic/agentChoice';
import { placesFor, type Place } from '../logic/places';
import Note from '../parts/Note';
import ProgressBar from '../parts/ProgressBar';
import { useNewAgent } from './useNewAgent';

// New agent, step 2: where the picked agent runs (logic/places.ts). A tap
// on a system makes the agent there; Download another Linux goes on to pick
// an OS and a version, and the download starts from its last look. A system
// shows its OS's logo, as the Systems list does. A place that cannot run
// this agent is dimmed and says why.
export default function ChoosePlace({ pick }: { pick: AgentPick }) {
  const push = useAppStore((s) => s.push);
  const envs = useLinuxStore((s) => s.envs);
  const linuxAvailable = useLinuxStore((s) => s.status.available);
  const kindsVersion = useKindsStore((s) => s.version);
  const newAgent = useNewAgent();
  const label = agentKind(pick.kindId).label;
  const places = useMemo(() => placesFor(envs, linuxAvailable), [envs, linuxAvailable]);

  // kindsVersion: a kind changed, so judge again.
  const blockedOf = useMemo(
    () => (place: Place) => {
      const offer = offersForEnv(place.env).find((o) => o.id === pick.kindId);
      return blockedText(offer ? offer.blocked : 'env_not_ready');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pick.kindId, kindsVersion],
  );

  const choose = (place: Place) => {
    if (newAgent.busy) return;
    if (place.target) newAgent.make(place.target, pick);
    else push({ name: 'new-env-os', pick });
  };

  return (
    <Screen>
      <PageHeader kicker="new agent · where" title="Where does it run?" />
      <Note>{`${label} gets its own machine, made from the system you pick. What it installs stays in that machine.`}</Note>
      {places.map((place) => {
        const blocked = blockedOf(place);
        return (
          <YStack key={place.key} opacity={blocked ? 0.5 : 1}>
            <AppCard
              title={place.title}
              subtitle={blocked ?? place.subtitle}
              icon={
                place.logoKeys.length > 0 ? (
                  <SystemLogo keys={place.logoKeys} letter={place.title.charAt(0).toUpperCase()} size={32} />
                ) : undefined
              }
              onPress={blocked ? undefined : () => choose(place)}
              chevron={!blocked}
            >
              {place.recommended && !blocked ? <Stamp>recommended</Stamp> : null}
            </AppCard>
          </YStack>
        );
      })}
      {newAgent.busy ? <ProgressBar label={`Making ${label}`} fraction={null} /> : null}
      {newAgent.error ? <Note tone="error">{newAgent.error}</Note> : null}
      <Note>Not a security sandbox: what runs in a machine can reach the network and this app's files.</Note>
    </Screen>
  );
}
