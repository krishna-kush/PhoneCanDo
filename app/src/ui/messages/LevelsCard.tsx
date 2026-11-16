import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { XStack, YStack } from 'tamagui';
import { useAgentsStore } from '../../state/agents';
import { kindLevelNow, useChecksStore } from '../../state/checks';
import ChevronIcon from '../common/ChevronIcon';
import { useTheme } from '../common/globals';
import PlainText from '../common/PlainText';
import KeyHead from '../common/rows/KeyHead';
import { ROW_GUTTER } from '../common/rows/place';
import { LEVELS_HEADING, levelRows } from './logic/levels';

// Under the Messages page's intro, one closed box: "How messages reach
// each agent" on a key strip (as every RowGroup's title) with an arrow. A
// tap on the strip opens how far messages reach each agent by its kind's
// level now (delivered and can be woken, delivered, inbox only, can't
// read; lowered by what we saw not working), with the user's agents at
// each, so the messages themselves stay first. Closed, the box clips the
// strip's own bottom line, so only the box's line shows.
// All four always show, so the levels read the same whatever agents there are.
export default function LevelsCard() {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const agents = useAgentsStore((s) => s.agents);
  const levels = useChecksStore((s) => s.levels);
  const rows = useMemo(() => (open ? levelRows(agents, (kind) => kindLevelNow(levels, kind)) : []), [agents, levels, open]);
  return (
    <YStack overflow="hidden" borderWidth={1} borderColor="line" backgroundColor="panel">
      <YStack marginBottom={-1}>
        <Pressable
          onPress={() => setOpen((v) => !v)}
          android_ripple={{ color: t.secondarySoft }}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={LEVELS_HEADING}
        >
          <KeyHead title={LEVELS_HEADING} barcode="messageLevels" trailing={<ChevronIcon dir={open ? 'down' : 'right'} size={12} color={t.dim} />} />
        </Pressable>
        {open ? (
          <YStack paddingHorizontal={ROW_GUTTER} paddingTop="3" paddingBottom="3" gap="3">
            {rows.map((row) => (
              <YStack key={row.level} gap="1" opacity={row.names.length > 0 ? 1 : 0.6}>
                <XStack alignItems="baseline" gap="2" flexWrap="wrap">
                  <PlainText fontSize={14} fontWeight="600">
                    {row.title}
                  </PlainText>
                  <PlainText fontFamily="mono" fontSize={12} color={row.level === 'none' ? 'primary' : 'dim'} flexShrink={1}>
                    {row.names.length > 0 ? row.names.join(', ') : 'none of your agents'}
                  </PlainText>
                </XStack>
                <PlainText fontSize={13} color="muted">
                  {row.meaning}
                </PlainText>
              </YStack>
            ))}
          </YStack>
        ) : null}
      </YStack>
    </YStack>
  );
}
