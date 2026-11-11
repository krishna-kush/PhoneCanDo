import { useCallback, useState } from 'react';
import { XStack, YStack } from 'tamagui';
import type { ModelFilters } from '../../../engine/models/types';
import { activeFilters, CLEARED, filtersText, SORT_OPTIONS, sortText } from '../logic/filters';
import ActiveFilters from './ActiveFilters';
import FilterButton from './FilterButton';
import FilterPicker from './FilterPicker';
import FilterSheet from './FilterSheet';

// The Hugging Face list's filters, for the list before any query and for
// search results alike, with nothing that scrolls sideways: one row of two
// half-width buttons, Sort (its choices in a menu) and Filters (Size,
// License and Models in a sheet, "Filters · 2" while two are on), and the
// filters that are on in a line under them.
export default function HfFilters({
  filters,
  onChange,
}: {
  filters: ModelFilters;
  onChange: (change: Partial<ModelFilters>) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const on = activeFilters(filters).length;

  return (
    <YStack gap="2">
      <XStack gap="2" alignItems="stretch">
        <YStack flex={1} flexBasis={0} minWidth={0}>
          <FilterPicker
            text={sortText(filters.sort)}
            label={sortText(filters.sort)}
            options={SORT_OPTIONS}
            value={filters.sort}
            onChange={(sort) => onChange({ sort })}
          />
        </YStack>
        <YStack flex={1} flexBasis={0} minWidth={0}>
          <FilterButton
            text={filtersText(filters)}
            label={on > 0 ? `Filters, ${on} on` : 'Filters'}
            changed={on > 0}
            onPress={() => setSheetOpen(true)}
          />
        </YStack>
      </XStack>
      <ActiveFilters filters={filters} onClear={() => onChange(CLEARED)} />
      <FilterSheet open={sheetOpen} onClose={closeSheet} filters={filters} onChange={onChange} />
    </YStack>
  );
}
