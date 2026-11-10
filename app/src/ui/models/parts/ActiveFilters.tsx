import { Fragment } from 'react';
import { Button, Text, XStack } from 'tamagui';
import type { ModelFilters } from '../../../engine/models/types';
import { HIT, useTheme } from '../../common/globals';
import { activeFilters } from '../logic/filters';

// The filters that are on, under the Sort and Filters buttons: "Up to 2B ·
// Apache 2.0 · Clear". It wraps onto more lines rather than scrolling, and
// is not there while none is on. Clear sets every filter back to what the
// page opens on; the sort stays.
export default function ActiveFilters({ filters, onClear }: { filters: ModelFilters; onClear: () => void }) {
  const t = useTheme();
  const on = activeFilters(filters);
  if (on.length === 0) return null;
  return (
    <XStack flexWrap="wrap" alignItems="center" columnGap="$2" minHeight={HIT.minTouch}>
      {on.map((label) => (
        <Fragment key={label}>
          <Text fontSize={13} color={t.fg} flexShrink={1}>
            {label}
          </Text>
          <Text fontSize={13} color={t.dim}>
            ·
          </Text>
        </Fragment>
      ))}
      <Button
        chromeless
        minHeight={HIT.minTouch}
        paddingHorizontal="$2"
        borderRadius={0}
        fontSize={12}
        letterSpacing={0.8}
        textProps={{ textTransform: 'uppercase' }}
        onPress={onClear}
        accessibilityLabel="Clear filters"
      >
        Clear
      </Button>
    </XStack>
  );
}
