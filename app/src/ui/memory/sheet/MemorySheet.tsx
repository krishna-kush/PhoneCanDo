import { XStack } from 'tamagui';
import { useMemoryStore } from '../../../state/memory';
import AppButton from '../../common/AppButton';
import BottomSheet from '../../common/sheet/BottomSheet';
import HazardTape from '../../env/parts/HazardTape';
import SheetBody from './SheetBody';

// The RAM warning: a sheet that slides up over whatever is open
// (common/sheet/BottomSheet.tsx, so it covers pages and the drawer alike). It opens by itself once per
// episode (state/logic/memoryEpisode.ts) and from the pill, the bar chip
// or Settings → Agents & models at any time. "I'll handle it", Back, a
// tap outside or a drag down closes it; the pill keeps the countdown in sight after.
// The hazard tape and the button stay put while the rest scrolls.
export default function MemorySheet() {
  const open = useMemoryStore((s) => s.sheetOpen);
  const closeSheet = useMemoryStore((s) => s.closeSheet);
  const level = useMemoryStore((s) => s.status.level);
  return (
    <BottomSheet
      open={open}
      onClose={closeSheet}
      header={level === 'critical' ? <HazardTape /> : undefined}
      footer={
        <XStack paddingHorizontal="4" paddingVertical="3" borderTopWidth={1} borderColor="line">
          <AppButton flex={1} variant={level === 'ok' ? 'primary' : 'secondary'} onPress={closeSheet}>
            {level === 'ok' ? 'Done' : "I'll handle it"}
          </AppButton>
        </XStack>
      }
    >
      {/* Mounted anew each opening, so each has its own headline. */}
      <SheetBody />
    </BottomSheet>
  );
}
