import { useMemo, useState } from 'react';
import { XStack, YStack } from 'tamagui';
import { agentKind } from '../../engine/agents/registry';
import { useAgentsStore } from '../../state/agents';
import ChevronIcon from '../common/ChevronIcon';
import { useTheme } from '../common/globals';
import PlainText from '../common/PlainText';
import { LEVELS_HEADING, levelRows } from './logic/levels';

// Under the Messages page's intro, one closed line: "How messages reach
// each agent". A tap opens how far messages reach each agent by its kind's
// level (delivered and can be woken, delivered, inbox only, can't read),
// with the user's agents at each, so the messages themselves stay first.
// All four always show, so the levels read the same whatever agents there are.
export default function LevelsCard() {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const agents = useAgentsStore((s) => s.agents);
  const rows = useMemo(() => (open ? levelRows(agents, (kind) => agentKind(kind).messaging) : []), [agents, open]);
  return (
    <YStack borderWidth={1} borderColor="line" backgroundColor="panel">
      <XStack
        alignItems="center"
        gap="2"
        paddingHorizontal="3"
        paddingVertical="2"
        minHeight={44}
        opacity="press:0.7"
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={LEVELS_HEADING}
      >
        <PlainText flex={1} fontFamily="mono" fontSize={12} letterSpacing={1.2} color="secondaryInk" textTransform="uppercase">
          {LEVELS_HEADING}
        </PlainText>
        <ChevronIcon dir={open ? 'down' : 'right'} size={12} color={t.dim} />
      </XStack>
      {open ? (
        <YStack paddingHorizontal="3" paddingBottom="3" gap="3">
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
  );
}
