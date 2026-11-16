import type { ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';
import ChevronIcon from '../../common/ChevronIcon';
import { HIT, useTheme } from '../../common/globals';
import PlainText from '../../common/PlainText';
import { ADVANCED_TITLE, ADVANCED_WHAT } from '../logic/memory';

type Props = { open: boolean; onOpen: (open: boolean) => void; count: string; children: ReactNode };

// The Memory setting's Advanced, folded: an expand control across the
// setting, not one more option ("Advanced", how many are not Auto and a
// chevron, down closed and up open), with what is in it under while
// closed; its choices keep their values while closed.
export default function AdvancedFold({ open, onOpen, count, children }: Props) {
  const t = useTheme();
  const spoken = [ADVANCED_TITLE, count, open ? '' : ADVANCED_WHAT].filter((s) => s !== '').join(', ');
  return (
    <YStack gap="3">
      <YStack
        minHeight={HIT.buttonH}
        justifyContent="center"
        gap="1"
        paddingVertical="2"
        opacity="press:0.7"
        onPress={() => onOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={spoken}
      >
        <XStack alignItems="center" gap="3">
          <PlainText flex={1} minWidth={0} fontSize={16} fontWeight="600">
            {ADVANCED_TITLE}
          </PlainText>
          {count !== '' ? (
            <PlainText fontFamily="mono" fontSize={12} color="dim">
              {count}
            </PlainText>
          ) : null}
          <YStack rotate={open ? '180deg' : '0deg'}>
            <ChevronIcon dir="down" size={14} color={t.dim} />
          </YStack>
        </XStack>
        {!open ? (
          <PlainText fontSize={13} color="dim">
            {ADVANCED_WHAT}
          </PlainText>
        ) : null}
      </YStack>
      {open ? children : null}
    </YStack>
  );
}
