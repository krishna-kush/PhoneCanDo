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
    <XStack flexWrap="wrap" alignItems="center" columnGap="2" minHeight={HIT.minTouch}>
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
        variant="quiet"
        opacity="1 press:1"
        minHeight={HIT.minTouch}
        paddingHorizontal="2"
        borderRadius={0}
        fontFamily="mono"
        fontSize={12}
        fontWeight="400"
        letterSpacing={0.8}
        ellipsis
        textProps={{ textTransform: 'uppercase' }}
        onPress={onClear}
        accessibilityLabel="Clear filters"
      >
        Clear
      </Button>
    </XStack>
  );
}
