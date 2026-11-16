import { useRef } from 'react';
import { YStack } from 'tamagui';
import AppButton from '../../../common/AppButton';
import PlainText from '../../../common/PlainText';
import BottomSheet from '../../../common/sheet/BottomSheet';
import type { FieldHelp } from '../../logic/customAgentText';

export type OpenHelp = { label: string; help: FieldHelp };

// A field's help from its info button, in the app's sheet: its name, what
// it means left empty (or off), and more where the idea needs it. The last
// help stays in it while it slides away.
export default function HelpSheet({ shown, onClose }: { shown: OpenHelp | null; onClose: () => void }) {
  const last = useRef(shown);
  if (shown) last.current = shown;
  return (
    <BottomSheet open={shown != null} onClose={onClose}>
      {last.current ? <SheetBody shown={last.current} onClose={onClose} /> : null}
    </BottomSheet>
  );
}

function SheetBody({ shown, onClose }: { shown: OpenHelp; onClose: () => void }) {
  return (
    <YStack padding="4" gap="3">
      <PlainText fontSize={18} fontWeight="700">
        {shown.label}
      </PlainText>
      <PlainText fontSize={15} color="fg">
        {shown.help.empty}
      </PlainText>
      {shown.help.more ? (
        <PlainText fontSize={14} color="muted">
          {shown.help.more}
        </PlainText>
      ) : null}
      <AppButton variant="secondary" onPress={onClose}>
        Got it
      </AppButton>
    </YStack>
  );
}
