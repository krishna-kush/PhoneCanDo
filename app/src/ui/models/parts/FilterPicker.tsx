import { useState } from 'react';
import { Popover, YStack } from 'tamagui';
import MenuItem from '../../common/MenuItem';
import { useTheme } from '../../common/globals';
import type { FilterOption } from '../logic/filters';
import FilterButton from './FilterButton';

// One choice of the Hugging Face list (its sort): a half-width button with
// the choice in its words; a tap opens the choices as the shared menu rows,
// the current one ticked.
export default function FilterPicker<T>({
  text,
  label,
  options,
  value,
  onChange,
}: {
  text: string;
  /** What a screen reader says of the button. */
  label: string;
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-start" offset={4}>
      <Popover.Trigger asChild>
        <FilterButton text={text} label={label} changed={value !== options[0]?.value} onPress={() => setOpen(true)} />
      </Popover.Trigger>
      <Popover.Content
        borderWidth={1}
        borderColor={t.lineStrong}
        borderRadius={0}
        padding="$2"
        enterStyle={{ y: -10, opacity: 0 }}
        exitStyle={{ y: -10, opacity: 0 }}
        elevate
      >
        <YStack gap="$1" minWidth={200}>
          {options.map((o) => (
            <MenuItem
              key={o.label}
              label={o.value === value ? `✓ ${o.label}` : o.label}
              onPress={() => {
                setOpen(false);
                if (o.value !== value) onChange(o.value);
              }}
            />
          ))}
        </YStack>
      </Popover.Content>
    </Popover>
  );
}
