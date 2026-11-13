import { useEffect, useRef, useState } from 'react';
import { XStack, YStack } from 'tamagui';
import { useActiveAgent } from '../../state/agents';
import { useAppStore } from '../../state/app';
import type { MissionId } from '../../state/logic/starter/missions';
import { progress } from '../../state/logic/starter/shift';
import { useMascotsStore } from '../../state/mascots';
import { useStarterStore } from '../../state/starter';
import AppButton from '../common/AppButton';
import AgentFace from '../common/face/AgentFace';
import { boopLine } from '../common/face/lines';
import { useAgentLook } from '../common/face/useAgentLook';
import PageHeader from '../common/PageHeader';
import PlainText from '../common/PlainText';
import Screen from '../common/Screen';
import Note from '../env/parts/Note';
import { usePageActive } from '../nav/pageActive';
import { missionCopy, PAGE_LEAD, pageLine, SHIFT_TITLE, shiftKicker, SKIP_ALL } from './copy';
import Finale from './Finale';
import MissionCard from './MissionCard';
import { REWARD_DESIGN } from './reward';
import { useMissionGo } from './useMissionGo';
import { useShiftMissions } from './useShiftMissions';

// The first shift: the active agent's face up top (tap it), then this
// phone's missions in order, the next one open. Each is ticked when the app
// sees it happen (ShiftSignals.tsx), and any can be skipped, or the whole
// shift. Once each has a mark, the finale.
export default function ShiftPage() {
  const agent = useActiveAgent();
  const look = useAgentLook(agent?.id ?? '');
  const active = usePageActive();
  const shift = useStarterStore((s) => s.shift);
  const { missions, ctx } = useShiftMissions();
  const mission = useMissionGo(missions);
  const goHome = useAppStore((s) => s.goHome);
  const [line] = useState(() => pageLine(Math.random() * 1000));
  const [boops, setBoops] = useState(0);
  // Done before this page opened: those stamps are already down.
  const [doneBefore] = useState(() => new Set(missions.filter((id) => shift.marks[id] === 'done')));
  // The mission opened by a tap; undefined follows the next one.
  const [picked, setPicked] = useState<MissionId | null | undefined>(undefined);

  const p = progress(shift, missions);
  const open = picked !== undefined ? picked : p.next;

  // A mission done or skipped: the next one opens (Try it takes a mark
  // away, and its mission stays open).
  const marked = p.done + p.skipped;
  const lastMarked = useRef(marked);
  useEffect(() => {
    if (marked > lastMarked.current) setPicked(undefined);
    lastMarked.current = marked;
  }, [marked]);

  const store = useStarterStore.getState;
  const putOn = () => {
    if (agent) useMascotsStore.getState().setLook(agent.id, { ...look.mascot, design: REWARD_DESIGN });
  };

  return (
    <Screen>
      <PageHeader kicker={shiftKicker(p.done, p.total)} title={SHIFT_TITLE} />
      <XStack alignItems="center" gap="3">
        <YStack
          onPress={() => setBoops((n) => n + 1)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`${look.serial}, your agent. Tap it.`}
        >
          <AgentFace mood={look.mood} mascot={look.mascot} size={36} hop={boops} still={!active} />
        </YStack>
        <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.4} color="dim" textTransform="uppercase" flexShrink={1}>
          {`${look.serial} · ${boops > 0 ? boopLine(boops - 1) : line}`}
        </PlainText>
      </XStack>
      <PlainText fontSize={15} color="muted">
        {PAGE_LEAD}
      </PlainText>

      <YStack gap="3">
        {missions.map((id, i) => (
          <MissionCard
            key={id}
            id={id}
            n={i + 1}
            copy={missionCopy(id, ctx)}
            mark={shift.marks[id]}
            open={open === id}
            fresh={!doneBefore.has(id)}
            linux={ctx.linux}
            busy={id === 'teammate' && mission.busy}
            onToggle={() => setPicked(open === id ? null : id)}
            onGo={(dare) => mission.go(id, dare)}
            onCopy={mission.copy}
            onSkip={() => store().skip(id)}
            onTryAgain={() => {
              store().unskip(id);
              setPicked(id);
            }}
          />
        ))}
      </YStack>
      {mission.note ? <Note>{mission.note}</Note> : null}
      {mission.error ? <Note tone="error">{mission.error}</Note> : null}

      {p.next == null ? (
        <Finale
          serial={look.serial}
          mascot={look.mascot}
          earned={shift.earned}
          skipped={p.skipped}
          still={!active}
          onPutOn={putOn}
          onBack={() => {
            store().finish();
            goHome();
          }}
          onStartOver={() => store().restart()}
        />
      ) : (
        <XStack justifyContent="center">
          <AppButton
            variant="ghost"
            onPress={() => {
              store().windOff();
              goHome();
            }}
          >
            {SKIP_ALL}
          </AppButton>
        </XStack>
      )}
    </Screen>
  );
}
