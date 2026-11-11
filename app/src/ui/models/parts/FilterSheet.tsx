import { useEffect } from 'react';
import { Keyboard, useWindowDimensions } from 'react-native';
import { Sheet, YStack } from 'tamagui';
import type { ModelFilters } from '../../../engine/models/types';
import AppButton from '../../common/AppButton';
import MenuItem from '../../common/MenuItem';
import SectionTitle from '../../common/SectionTitle';
import { useTheme } from '../../common/globals';
import { useBackInterceptor } from '../../nav/interceptors';
import { type FilterOption, KIND_OPTIONS, LICENSE_OPTIONS, SIZE_OPTIONS, type SheetFilters } from '../logic/filters';

// The share of the screen the choices may take before they scroll (a small
// phone at a large font size); the rest is the sheet's edge and Done.
const CHOICES_SHARE = 0.7;

// The Hugging Face list's filters: Size, License and Models, each a short
// list with the current choice ticked. A tap applies it at once and the
// sheet stays open for the next one; Done, a swipe down, a tap outside or
// Back closes it.
export default function FilterSheet({
  open,
  onClose,
  filters,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  filters: ModelFilters;
  onChange: (change: Partial<SheetFilters>) => void;
}) {
  const t = useTheme();
  const { height } = useWindowDimensions();

  // The search field may hold the keyboard, which would cover the sheet.
  // Back closes the sheet first, before the page (ui/nav/interceptors.ts).
  useEffect(() => {
    if (open) Keyboard.dismiss();
  }, [open]);
  useBackInterceptor(open, onClose);

  return (
    <Sheet
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
      modal
      dismissOnSnapToBottom
      snapPointsMode="fit"
    >
      <Sheet.Frame
        padding="$4"
        paddingBottom="$6"
        gap="$3"
        borderRadius={0}
        borderWidth={1}
        borderColor={t.lineStrong}
      >
        <Sheet.ScrollView maxHeight={height * CHOICES_SHARE}>
          <Choices title="Size" options={SIZE_OPTIONS} value={filters.size} onChange={(size) => onChange({ size })} />
          <Choices
            title="License"
            options={LICENSE_OPTIONS}
            value={filters.license}
            onChange={(license) => onChange({ license })}
          />
          <Choices
            title="Models"
            options={KIND_OPTIONS}
            value={filters.chatOnly}
            onChange={(chatOnly) => onChange({ chatOnly })}
          />
        </Sheet.ScrollView>
        <AppButton variant="secondary" onPress={onClose}>
          Done
        </AppButton>
      </Sheet.Frame>
      <Sheet.Overlay />
    </Sheet>
  );
}

function Choices<T>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <YStack>
      <SectionTitle>{title}</SectionTitle>
      {options.map((o) => (
        <MenuItem
          key={o.label}
          label={o.value === value ? `✓ ${o.label}` : o.label}
          onPress={() => {
            if (o.value !== value) onChange(o.value);
          }}
        />
      ))}
    </YStack>
  );
}
