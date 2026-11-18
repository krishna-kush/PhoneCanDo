import { useState } from 'react';
import { BackHandler, Pressable } from 'react-native';
import { XStack, YStack } from 'tamagui';
import { useActiveAgent, useAgentsStore } from '../../state/agents';
import { useAppStore } from '../../state/app';
import { renameAgentTo } from '../../state/flows/renameAgent';
import { useStarterStore } from '../../state/starter';
import AppButton from '../common/AppButton';
import BoopFace from '../common/face/BoopFace';
import { boopLine } from '../common/face/lines';
import { useAgentLook } from '../common/face/useAgentLook';
import PlainText from '../common/PlainText';
import PromptDialog from '../common/PromptDialog';
import BottomSheet from '../common/sheet/BottomSheet';
import SheetScroll from '../common/sheet/SheetScroll';
import { AGREE_LINE, READ_IT } from '../terms/copy';
import LicenseTextView from '../terms/LicenseTextView';
import { LICENSE_VERSION } from '../terms/licenseText';
import { useNeedsAgreement } from '../terms/useLicenseAsk';
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
// for About to bring back. It is onboarding's last step, so it also takes
// the license: until this install agrees, a line above the buttons says
// either one agrees, and nothing else closes the sheet (Back leaves the app).
export default function HelloSheet() {
  const agent = useActiveAgent();
  const look = useAgentLook(agent?.id ?? '');
  const state = useAgentsStore((s) => (agent ? s.statuses[agent.id]?.state : undefined));
  const hydrated = useStarterStore((s) => s.hydrated);
  const status = useStarterStore((s) => s.shift.status);
  const push = useAppStore((s) => s.push);
  const { missions, hands } = useShiftMissions();
  const [boops, setBoops] = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [reading, setReading] = useState(false);
  const mustAgree = useNeedsAgreement();

  const open = agent != null && hydrated && status === 'new';
  const up = state === 'ready';

  // Either button agrees to the license first, while it is still owed.
  const agree = () => {
    if (mustAgree) void useAppStore.getState().agreeToLicense(LICENSE_VERSION);
  };
  const windOff = () => {
    agree();
    useStarterStore.getState().windOff();
  };
  const begin = () => {
    agree();
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
    <BottomSheet
      open={open}
      onClose={() => useStarterStore.getState().windOff()}
      locked={mustAgree}
      onBlocked={() => BackHandler.exitApp()}
    >
      <SheetScroll contentContainerStyle={{ padding: 16, gap: 12 }}>
        <XStack alignItems="center" gap="4">
          <BoopFace mood={look.mood} mascot={look.mascot} size={56} label={`${look.desk}, your agent. Tap it.`} onBoop={setBoops} />
          <YStack flex={1} minWidth={0} gap="1">
            <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.4} color="dim" textTransform="uppercase">
              {boops > 0 ? `${look.desk} · ${boopLine(boops - 1)}` : helloCaption(look.desk, up)}
            </PlainText>
            <PlainText fontSize={22} fontWeight="700" numberOfLines={2}>
              {helloTitle(agent?.name ?? look.desk)}
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
        {mustAgree ? (
          <XStack gap="2" alignItems="center" flexWrap="wrap">
            <PlainText fontSize={13} color="dim">
              {AGREE_LINE}
            </PlainText>
            <Pressable onPress={() => setReading(true)} accessibilityRole="link" hitSlop={8}>
              <PlainText fontSize={13} color="primary" textDecorationLine="underline">
                {READ_IT}
              </PlainText>
            </Pressable>
          </XStack>
        ) : null}
        <XStack gap="2" justifyContent="flex-end" flexWrap="wrap">
          <AppButton variant="ghost" onPress={windOff}>
            {WING_IT}
          </AppButton>
          <AppButton onPress={begin}>{START}</AppButton>
        </XStack>
        <PlainText fontSize={12} color="dim">
          {LATER_NOTE}
        </PlainText>
      </SheetScroll>
      <PromptDialog
        open={renaming}
        onClose={() => setRenaming(false)}
        title={RENAME_TITLE}
        value={name}
        onChangeText={setName}
        confirmLabel={RENAME_CONFIRM}
        onConfirm={rename}
      />
      <LicenseTextView open={reading} onClose={() => setReading(false)} />
    </BottomSheet>
  );
}
