import { Text, XStack, YStack } from 'tamagui';
import { useAgentsStore } from '../../state/agents';
import { useAppStore, type TerminalSession } from '../../state/app';
import CardMenu, { type CardMenuItem } from '../common/CardMenu';
import { HIT, useTheme } from '../common/globals';
import { usePageActive } from '../nav/pageActive';
import TerminalScreen from './TerminalScreen';

// A terminal as a page: a bar saying what it is attached to (the folder of
// a terminal UI, whose machine a Linux shell runs in) with its ⋮ menu,
// over the terminal itself. Back closes it, as does the menu (no button
// of its own: Android's Back is the way back). It holds the
// keyboard only while it is the page in front.
export default function TerminalPage({ session }: { session: TerminalSession }) {
  const t = useTheme();
  const active = usePageActive();
  const closeTerminal = useAppStore((s) => s.closeTerminal);
  const push = useAppStore((s) => s.push);
  const agentName = useAgentsStore((s) => s.agents.find((a) => a.id === session.agentId)?.name ?? 'Agent');
  const title = session.kind === 'linux' ? `${agentName} · Linux` : (session.dir.split('/').filter(Boolean).pop() ?? 'Terminal');
  const kicker = session.kind === 'linux' ? 'shell' : `terminal UI · ${agentName}`;
  const closeLabel = session.kind === 'linux' ? 'Close terminal' : 'Back to web UI';

  const menu: CardMenuItem[] = [
    { label: closeLabel, onSelect: closeTerminal },
    { label: 'Settings', onSelect: () => push({ name: 'settings' }) },
    { label: 'About', onSelect: () => push({ name: 'about' }) },
  ];

  return (
    <YStack flex={1} backgroundColor={t.panel}>
      <XStack
        alignItems="center"
        gap="2"
        paddingHorizontal="3"
        paddingVertical="2"
        minHeight={HIT.headerH}
        borderBottomWidth={1}
        borderColor={t.line}
        backgroundColor={t.panel}
      >
        <YStack flex={1} minWidth={0}>
          <Text fontFamily="mono" fontSize={10} letterSpacing={1.4} color={t.dim} textTransform="uppercase" numberOfLines={1}>
            {kicker}
          </Text>
          <Text fontFamily="mono" fontSize={17} fontWeight="600" letterSpacing={-0.3} numberOfLines={1} ellipsizeMode="tail">
            {title}
          </Text>
        </YStack>
        <CardMenu items={menu} label="Menu" offset={-24} />
      </XStack>
      <TerminalScreen session={session} active={active} />
    </YStack>
  );
}
