import { Fragment } from 'react';
import { Button, XStack } from 'tamagui';
import type { ModelFilters } from '../../../engine/models/types';
import { HIT } from '../../common/globals';
import PlainText from '../../common/PlainText';
import { activeFilters } from '../logic/filters';

// The filters that are on, under the Sort and Filters buttons: "Up to 2B ·
// Apache 2.0 · Clear". It wraps onto more lines rather than scrolling, and
// is not there while none is on. Clear sets every filter back to what the
// page opens on; the sort stays.
export default function ActiveFilters({ filters, onClear }: { filters: ModelFilters; onClear: () => void }) {
  const on = activeFilters(filters);
  if (on.length === 0) return null;
  return (
    <XStack flexWrap="wrap" alignItems="center" columnGap="2" minHeight={HIT.minTouch}>
      {on.map((label) => (
        <Fragment key={label}>
          <PlainText fontSize={13} color="fg" flexShrink={1}>
            {label}
          </PlainText>
          <PlainText fontSize={13} color="dim">
            ·
          </PlainText>
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
