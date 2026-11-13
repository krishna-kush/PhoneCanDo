import { useState } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from 'tamagui';
import { useActiveAgent, useAgentsStore } from '../../state/agents';
import { useAppStore } from '../../state/app';
import { renameAgentTo } from '../../state/flows/renameAgent';
import { useStarterStore } from '../../state/starter';
import AppButton from '../common/AppButton';
import BottomSheet from '../common/BottomSheet';
import AgentFace from '../common/face/AgentFace';
import { boopLine } from '../common/face/lines';
import { useAgentLook } from '../common/face/useAgentLook';
import PlainText from '../common/PlainText';
import PromptDialog from '../common/PromptDialog';
import {
  helloCaption,
  helloLine,
  helloShift,
  helloTitle,
  LATER_NOTE,
  RENAME,
  RENAME_CONFIRM,
  RENAME_TITLE,
  START,
  WING_IT,
} from './copy';
import { useShiftMissions } from './useShiftMissions';

// The first shift's hello, once, over Home as soon as the first agent is
// there: the agent's own face (tap it; it wakes up while its engine
// starts), its name with a way to give it another, what it does, and the
// offer: Start shift opens the page, I'll wing it (or Back) waves it off
// for About to bring back.
export default function HelloSheet() {
  const agent = useActiveAgent();
  const look = useAgentLook(agent?.id ?? '');
  const state = useAgentsStore((s) => (agent ? s.statuses[agent.id]?.state : undefined));
  const hydrated = useStarterStore((s) => s.hydrated);
  const status = useStarterStore((s) => s.shift.status);
  const push = useAppStore((s) => s.push);
  const { missions, hands } = useShiftMissions();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [boops, setBoops] = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');

  const open = agent != null && hydrated && status === 'new';
  const up = state === 'ready';

  const begin = () => {
    useStarterStore.getState().start();
    push({ name: 'starter' });
  };
  const rename = () => {
    if (!agent) return;
    try {
      renameAgentTo(agent.id, name);
    } catch {
      // the old name stays; the agent's page can try again
    }
    setRenaming(false);
  };

  return (
    <BottomSheet open={open} onClose={() => useStarterStore.getState().windOff()} closeLabel={WING_IT}>
      <YStack
        backgroundColor="panel"
        borderTopWidth={1}
        borderColor="lineStrong"
        maxHeight={height * 0.85}
        paddingBottom={insets.bottom}
      >
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <XStack alignItems="center" gap="4">
            <YStack
              onPress={() => setBoops((n) => n + 1)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`${look.serial}, your agent. Tap it.`}
            >
              <AgentFace mood={look.mood} mascot={look.mascot} size={56} hop={boops} />
            </YStack>
            <YStack flex={1} minWidth={0} gap="1">
              <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.4} color="dim" textTransform="uppercase">
                {boops > 0 ? `${look.serial} · ${boopLine(boops - 1)}` : helloCaption(look.serial, up)}
              </PlainText>
              <PlainText fontSize={22} fontWeight="700" numberOfLines={2}>
                {helloTitle(agent?.name ?? look.serial)}
              </PlainText>
            </YStack>
          </XStack>
          <PlainText fontSize={15}>{helloLine(hands)}</PlainText>
          <XStack>
            <AppButton
              variant="ghost"
              onPress={() => {
                setName(agent?.name ?? '');
                setRenaming(true);
              }}
            >
              {`${RENAME} ✎`}
            </AppButton>
          </XStack>
          <PlainText fontSize={15} color="muted">
            {helloShift(missions.length)}
          </PlainText>
          <XStack gap="2" justifyContent="flex-end" flexWrap="wrap">
            <AppButton variant="ghost" onPress={() => useStarterStore.getState().windOff()}>
              {WING_IT}
            </AppButton>
            <AppButton onPress={begin}>{START}</AppButton>
          </XStack>
          <PlainText fontSize={12} color="dim">
            {LATER_NOTE}
          </PlainText>
        </ScrollView>
      </YStack>
      <PromptDialog
        open={renaming}
        onClose={() => setRenaming(false)}
        title={RENAME_TITLE}
        value={name}
        onChangeText={setName}
        confirmLabel={RENAME_CONFIRM}
        onConfirm={rename}
      />
    </BottomSheet>
  );
}
