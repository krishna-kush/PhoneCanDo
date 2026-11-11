import { useEffect, useState } from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, YStack } from 'tamagui';
import { useMemoryStore } from '../../../state/memory';
import AppButton from '../../common/AppButton';
import BottomSheet from '../../common/BottomSheet';
import PlainText from '../../common/PlainText';
import HazardTape from '../../env/parts/HazardTape';
import Note from '../../env/parts/Note';
import { countdownLine } from '../logic/memoryCopy';
import { agentName } from '../logic/memoryRows';
import { useCountdown } from '../useCountdown';
import { useMemoryView } from '../useMemoryView';
import { useToldLine } from '../useToldLine';
import AgentsBox from './AgentsBox';
import ModelsBox from './ModelsBox';
import RamMeter from './RamMeter';
import SheetHead from './SheetHead';

// The share of the screen the warning may take before it scrolls.
const MAX_SHARE = 0.9;

// The RAM warning: a sheet that slides up over whatever is open
// (common/BottomSheet.tsx, so it covers pages and the drawer alike). It opens by itself once per
// episode (state/logic/memoryEpisode.ts) and from the pill, the bar chip
// or Settings → Agents & models at any time. "I'll handle it", Back or a
// tap outside closes it; the pill keeps the countdown in sight after.
export default function MemorySheet() {
  const open = useMemoryStore((s) => s.sheetOpen);
  const closeSheet = useMemoryStore((s) => s.closeSheet);
  return (
    <BottomSheet open={open} onClose={closeSheet} closeLabel="Close the RAM warning">
      {/* Mounted anew each opening, so each has its own headline. */}
      <SheetBody />
    </BottomSheet>
  );
}

function SheetBody() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const close = useMemoryStore((s) => s.closeSheet);
  const view = useMemoryView();
  const { status } = view;
  const level = status.level;
  const seconds = useCountdown(status.stopAt);
  // Seen in trouble while up: back at ok, it says phew instead of all calm.
  const [sawTrouble, setSawTrouble] = useState(level !== 'ok');
  useEffect(() => {
    if (level !== 'ok') setSawTrouble(true);
  }, [level]);
  const recovered = sawTrouble && level === 'ok';

  const nextName = status.nextStopAgentId ? agentName(view.info, status.nextStopAgentId) : null;
  const countdown = countdownLine(level, seconds, nextName, view.agents.length);
  const toldLine = useToldLine();

  return (
    <YStack
      backgroundColor="panel"
      borderTopWidth={1}
      borderColor="lineStrong"
      maxHeight={height * MAX_SHARE}
      paddingBottom={insets.bottom}
    >
      {level === 'critical' ? <HazardTape /> : null}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <SheetHead level={level} agents={view.agents.length} recovered={recovered} />
        {toldLine ? <Note>{toldLine}</Note> : null}
        {view.ram ? <RamMeter use={view.ram} level={level} warnBelowBytes={status.warnBelowBytes} /> : null}
        {countdown ? (
          <YStack
            borderWidth={1}
            borderColor={level === 'critical' ? 'primary' : 'secondaryLine'}
            backgroundColor={level === 'critical' ? 'primarySoft' : 'secondarySoft'}
            padding="3"
            accessibilityLiveRegion="polite"
          >
            <PlainText fontFamily="mono" fontSize={13} color={level === 'critical' ? 'primary' : 'secondaryInk'}>
              {countdown}
            </PlainText>
          </YStack>
        ) : null}
        <AgentsBox rows={view.agents} />
        <ModelsBox rows={view.models} level={level} />
        {view.agents.length === 0 && view.models.length === 0 ? (
          <Note>Nothing of ours is running right now: no agents, no local models.</Note>
        ) : null}
      </ScrollView>
      <XStack paddingHorizontal="4" paddingVertical="3" borderTopWidth={1} borderColor="line">
        <AppButton flex={1} variant={level === 'ok' ? 'primary' : 'secondary'} onPress={close}>
          {level === 'ok' ? 'Done' : "I'll handle it"}
        </AppButton>
      </XStack>
    </YStack>
  );
}
