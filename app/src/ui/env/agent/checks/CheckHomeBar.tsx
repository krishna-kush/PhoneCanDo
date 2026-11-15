import { useEffect, useRef, useState } from 'react';
import { Pressable } from 'react-native';
import { XStack } from 'tamagui';
import type { AgentId } from '../../../../engine/agents/records';
import { useAgentsStore } from '../../../../state/agents';
import { useAppStore } from '../../../../state/app';
import { useChecksStore } from '../../../../state/checks';
import PlainText from '../../../common/PlainText';
import { useHomeInFront } from '../../../nav/homeInFront';
import { homeBar, homeCheckAgent } from './logic/run';

type Props = { activeId: AgentId };

// A slim bar over Home while a check runs, of any agent, not only the one
// Home shows: "Checking <name> · Back to the check", which opens that
// agent's checks page (going Home leaves the pages, so the way back is that
// page again). With several running it names the active agent's, else the
// one started last. A check that ends while Home is in front leaves "Check
// done · See results" until you tap it or leave Home. Nothing otherwise.
export default function CheckHomeBar({ activeId }: Props) {
  const agents = useAgentsStore((s) => s.agents);
  const ids = agents.map((a) => a.id).join('\n');
  useEffect(() => useChecksStore.getState().watchChecks(ids ? ids.split('\n') : []), [ids]);
  const byAgent = useChecksStore((s) => s.byAgent);
  const inFront = useHomeInFront();
  const runningId = homeCheckAgent(
    agents.map((a) => ({ agentId: a.id, run: byAgent[a.id]?.run ?? null })),
    activeId,
  );

  const [endedId, setEndedId] = useState<AgentId | null>(null);
  const wasRunning = useRef(runningId);
  useEffect(() => {
    const was = wasRunning.current;
    wasRunning.current = runningId;
    if (was && was !== runningId && inFront && byAgent[was]?.run?.state !== 'running') setEndedId(was);
  }, [runningId, inFront, byAgent]);
  useEffect(() => {
    if (!inFront) setEndedId(null);
  }, [inFront]);

  const shownId = runningId ?? endedId;
  const agent = shownId ? agents.find((a) => a.id === shownId) : undefined;
  const run = shownId ? (byAgent[shownId]?.run ?? null) : null;
  const bar = agent && run ? homeBar(run, agent.name) : null;
  if (!agent || !bar) return null;

  const open = () => {
    setEndedId(null);
    useAppStore.getState().push({ name: 'agent-checks', agentId: agent.id });
  };

  return (
    <XStack
      backgroundColor="panel"
      borderBottomWidth={1}
      borderColor="lineStrong"
      paddingHorizontal="3"
      paddingVertical="2"
      gap="3"
      alignItems="center"
      justifyContent="space-between"
    >
      <PlainText fontFamily="mono" fontSize={12} color="secondaryInk" flexShrink={1} numberOfLines={1}>
        {bar.text}
      </PlainText>
      <Pressable onPress={open} hitSlop={8} accessibilityRole="link" accessibilityLabel={bar.action}>
        <PlainText fontSize={14} fontWeight="600" color="secondaryInk">
          {bar.action}
        </PlainText>
      </Pressable>
    </XStack>
  );
}
