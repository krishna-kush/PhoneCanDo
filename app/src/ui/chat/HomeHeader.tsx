import { Text, XStack } from 'tamagui';
import type { KindView } from '../../../../agents/kit/ts/contract/view.ts';
import type { Agent } from '../../engine/agents/records';
import { agentKind } from '../../engine/agents/registry';
import { useActiveAgent } from '../../state/agents';
import { useAppStore } from '../../state/app';
import CardMenu, { type CardMenuItem } from '../common/CardMenu';
import ChevronIcon from '../common/ChevronIcon';
import AgentFace from '../common/face/AgentFace';
import { useAgentLook } from '../common/face/useAgentLook';
import { HIT, useTheme } from '../common/globals';
import LogoMark from '../common/LogoMark';
import { useHomeInFront } from '../nav/homeInFront';
import MenuHead from './MenuHead';
import MemoryChip from '../memory/indicators/MemoryChip';
import NewMessagesChip from '../messages/NewMessagesChip';
import ReadingChip from '../models/parts/ReadingChip';
import { webGoHome } from './webNavigation';

// Home's 60dp bar. The left side is the active agent's chip, its face, name
// and a ⌄: a tap opens the drawer (the agents, New agent and the app's other
// places). It is `flex={1}` so a long name truncates instead of pushing the
// ⋮ menu off-screen, down to `minWidth` (the face and a few letters); past
// that the reading line shortens (the chips can all show at once). The ⋮ menu leads into the agent by what
// its home shows (agentItems) and to its page; the agent's face heads it
// (MenuHead) and each row has a shell-ish hint (`cd ~`, `>_`). While the agent's local model
// reads a prompt, a short line says so beside the name (ReadingChip),
// never changing the bar's height; so do new messages between agents since
// the user last looked (NewMessagesChip, a tap opens Messages) and the RAM
// warning's countdown while memory is short and the warning is closed
// (MemoryChip).
export default function HomeHeader() {
  const t = useTheme();
  const agent = useActiveAgent();
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen);
  const goHome = useAppStore((s) => s.goHome);
  const push = useAppStore((s) => s.push);
  const openFolderPicker = useAppStore((s) => s.openFolderPicker);
  const openLinuxTerminal = useAppStore((s) => s.openLinuxTerminal);
  const kind = agent ? agentKind(agent.kind) : null;

  const menuItems: CardMenuItem[] =
    agent && kind
      ? [
          ...agentItems(agent, kind, { goHome, openFolderPicker, openLinuxTerminal }),
          { label: 'Agent settings', hint: '--config', onSelect: () => push({ name: 'agent', agentId: agent.id }) },
        ]
      : [
          { label: 'Settings', hint: '--prefs', onSelect: () => push({ name: 'settings' }) },
          { label: 'About', hint: '-v', onSelect: () => push({ name: 'about' }) },
        ];

  return (
    <XStack
      alignItems="center"
      gap="2"
      paddingHorizontal="3"
      paddingVertical="2"
      minHeight={HIT.headerH}
      borderBottomWidth={1}
      borderColor="line"
      backgroundColor="panel"
    >
      <XStack
        alignItems="center"
        gap={8}
        flex={1}
        minWidth={88}
        minHeight={HIT.minTouch}
        opacity="press:0.7"
        onPress={() => setDrawerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={agent ? `Agent ${agent.name}. Opens the menu: agents, models, settings` : 'Open the menu'}
      >
        {agent ? <ChipFace agentId={agent.id} /> : <LogoMark size={13} />}
        <Text
          fontFamily="mono"
          fontSize={17}
          fontWeight="600"
          letterSpacing={-0.3}
          numberOfLines={1}
          flexShrink={1}
          minWidth={0}
          ellipsizeMode="tail"
        >
          {agent?.name ?? 'PhoneCanDo'}
        </Text>
        <ChevronIcon dir="down" size={12} color={t.dim} />
      </XStack>

      <ReadingChip agentId={agent?.id ?? null} />
      <NewMessagesChip />
      <MemoryChip />
      <CardMenu items={menuItems} label="Menu" offset={-24} head={<MenuHead agentId={agent?.id ?? null} />} />
    </XStack>
  );
}

// Still while a page covers Home.
function ChipFace({ agentId }: { agentId: Agent['id'] }) {
  const look = useAgentLook(agentId);
  const inFront = useHomeInFront();
  return <AgentFace mood={look.mood} pose={look.pose} size={16} still={!inFront} />;
}

type MenuActions = {
  goHome: () => void;
  openFolderPicker: () => void;
  openLinuxTerminal: (agentId: Agent['id']) => void;
};

// Ways into the active agent, by what its Home shows. A web home gets its
// home page and the kind's terminal UI (a client of the same engine, in a
// folder the picker chooses). A TUI home IS the engine's terminal, which
// takes one viewer, so nothing here opens it a second time: a shell in the
// agent's machine instead.
function agentItems(agent: Agent, kind: KindView, act: MenuActions): CardMenuItem[] {
  const home: CardMenuItem = {
    label: `${kind.label} home`,
    hint: 'cd ~',
    onSelect: () => {
      act.goHome();
      if (kind.home === 'web') webGoHome();
    },
  };
  if (kind.home === 'tui') {
    return [home, { label: 'Open Linux shell', hint: '$ sh', onSelect: () => act.openLinuxTerminal(agent.id) }];
  }
  return [home, { label: 'Open terminal UI', hint: '>_', onSelect: act.openFolderPicker }];
}
