import { useState, type ReactNode } from 'react';
import { Button, Popover, YStack } from 'tamagui';
import MenuDots from './MenuDots';
import MenuEntry from './MenuEntry';
import MenuItem from './MenuItem';
import { HIT } from './globals';

export type CardMenuItem = {
  label: string;
  danger?: boolean;
  /** A short mono aside at the row's end, e.g. `cd ~`. */
  hint?: string;
  onSelect: () => void;
};

// Shared ⋮ menu (header and per-row). Every item is a 48dp+ target; the menu
// itself is shared so the header / Home / Env all behave identically. Keeps
// destructive actions (Delete/Remove) out of the row's tap area — tap opens,
// ⋮ acts, long-press also opens the menu via the row.
//
// It has some fun opening: the ⋮ springs into a red ⋯ (MenuDots), the panel
// drops in on the logo's hard amber shadow and its rows deal out one after
// another (MenuEntry). `head` is an optional first line (Home's: the agent's
// face saying hi).
export default function CardMenu({
  items,
  label = 'Row actions',
  offset = -8,
  head,
}: {
  items: CardMenuItem[];
  label?: string;
  offset?: number;
  head?: ReactNode;
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
          scale="1 press:0.85"
          flexShrink={0}
          paddingHorizontal={0}
          justifyContent="center"
          alignItems="center"
          textAlign="center"
          onPress={() => setOpen(true)}
          accessibilityLabel={label}
        >
          <MenuDots open={open} />
        </Button>
      </Popover.Trigger>
      <Popover.Content
        borderWidth={1}
        borderColor="lineStrong"
        borderRadius={0}
        boxShadow="4px 4px 0 secondary"
        padding="2"
        y="enter:-14px exit:-10px"
        opacity="enter:0 exit:0"
      >
        <YStack gap="1" minWidth={200}>
          {head}
          {items.map((item, i) => (
            <MenuEntry key={item.label} index={i}>
              <MenuItem
                label={item.label}
                danger={item.danger}
                hint={item.hint}
                onPress={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              />
            </MenuEntry>
          ))}
        </YStack>
      </Popover.Content>
    </Popover>
  );
}
