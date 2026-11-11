import { useState } from 'react';
import { Button, Popover, YStack } from 'tamagui';
import DotsIcon from './DotsIcon';
import MenuItem from './MenuItem';
import { HIT } from './globals';

export type CardMenuItem = {
  label: string;
  danger?: boolean;
  onSelect: () => void;
};

// Shared ⋮ menu (header and per-row). Every item is a 48dp+ target; the menu
// itself is shared so the header / Home / Env all behave identically. Keeps
// destructive actions (Delete/Remove) out of the row's tap area — tap opens,
// ⋮ acts, long-press also opens the menu via the row.
export default function CardMenu({
  items,
  label = 'Row actions',
  offset = -8,
}: {
  items: CardMenuItem[];
  label?: string;
  offset?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-end" offset={offset}>
      <Popover.Trigger asChild>
        <Button
          width={HIT.minTouch}
          height={HIT.minTouch}
          borderRadius={0}
          fontSize={22}
          variant="quiet"
          opacity="1 press:1"
          flexShrink={0}
          paddingHorizontal={0}
          justifyContent="center"
          alignItems="center"
          textAlign="center"
          onPress={() => setOpen(true)}
          accessibilityLabel={label}
        >
          <DotsIcon />
        </Button>
      </Popover.Trigger>
      <Popover.Content
        borderWidth={1}
        borderColor="lineStrong"
        borderRadius={0}
        padding="2"
        y="enter:-10px exit:-10px"
        opacity="enter:0 exit:0"
      >
        <YStack gap="1" minWidth={200}>
          {items.map((item) => (
            <MenuItem
              key={item.label}
              label={item.label}
              danger={item.danger}
              onPress={() => {
                setOpen(false);
                item.onSelect();
              }}
            />
          ))}
        </YStack>
      </Popover.Content>
    </Popover>
  );
}
