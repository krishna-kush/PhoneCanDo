import { useState } from 'react';
import { Button, Sheet, Text, XStack } from 'tamagui';
import type { KindView } from '../../../../agents/kit/ts/contract/view.ts';
import type { Agent } from '../../engine/agents/records';
import { agentKind } from '../../engine/agents/registry';
import { useActiveAgent, useAgentsStore } from '../../state/agents';
import { useAppStore, type TerminalSession } from '../../state/app';
import { webGoBack, webGoHome } from '../chat/webNavigation';
import ReadingChip from '../models/parts/ReadingChip';
import AgentSheet from './agent-switcher/AgentSheet';
import EngineDot from './agent-switcher/EngineDot';
import ArrowIcon from './ArrowIcon';
import BackIcon from './BackIcon';
import AppButton from './AppButton';
import CardMenu, { type CardMenuItem } from './CardMenu';
import LicensesDialog from './LicensesDialog';
import LogoMark from './LogoMark';
import { HIT, useTheme } from './globals';

// 60dp app bar with one shared row layout: left side always
// `flex={1} minWidth={0}` so long titles truncate instead of pushing the ⋮
// menu off-screen. The title is the active agent's name; tapping it opens
// the agent switcher. Home IS that agent's own UI (no app-side
// projects/chats): the ⋮ menu leads into it by what its home shows (see
// agentItems), then Settings, About. An open terminal shows what it is
// attached to. While the agent's local model reads a prompt, a short line
// says so beside the title (ReadingChip), never changing the bar's height.
export default function AppHeader() {
  const t = useTheme();
  const terminal = useAppStore((s) => s.terminal);
  const closeTerminal = useAppStore((s) => s.closeTerminal);
  const setFolderPickerOpen = useAppStore((s) => s.setFolderPickerOpen);
  const openLinuxTerminal = useAppStore((s) => s.openLinuxTerminal);
  const footerTab = useAppStore((s) => s.footerTab);
  const setFooterTab = useAppStore((s) => s.setFooterTab);
  const webCanGoBack = useAppStore((s) => s.webCanGoBack);
  const agent = useActiveAgent();
  const agentState = useAgentsStore((s) => (agent ? s.statuses[agent.id]?.state : undefined));
  const terminalAgentName = useAgentsStore(
    (s) => s.agents.find((a) => a.id === terminal?.agentId)?.name ?? 'Agent',
  );
  const [aboutOpen, setAboutOpen] = useState(false);
  const [licensesOpen, setLicensesOpen] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);

  const title = terminal ? terminalTitle(terminal, terminalAgentName) : (agent?.name ?? 'PhoneCanDo');
  const kind = agent ? agentKind(agent.kind) : null;
  // Closing returns to the tab underneath: the web UI for the terminal UI,
  // usually the Env tab for a Linux shell.
  const closeLabel = terminal?.kind === 'linux' ? 'Close terminal' : 'Back to web UI';

  const menuItems: CardMenuItem[] = terminal
    ? [
        { label: closeLabel, onSelect: () => closeTerminal() },
        { label: 'Settings', onSelect: () => setFooterTab('settings') },
        { label: 'About', onSelect: () => setAboutOpen(true) },
      ]
    : [
        ...(agent && kind
          ? agentItems(agent, kind, {
              goHome: () => setFooterTab('home'),
              openFolderPicker: () => setFolderPickerOpen(true),
              openLinuxTerminal,
            })
          : []),
        { label: 'Settings', onSelect: () => setFooterTab('settings') },
        { label: 'About', onSelect: () => setAboutOpen(true) },
      ];

  return (
    <XStack
      alignItems="center"
      gap="$2"
      paddingHorizontal="$3"
      paddingVertical="$2"
      minHeight={HIT.headerH}
      borderBottomWidth={1}
      borderColor={t.line}
      backgroundColor={t.panel}
    >
      <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
        {terminal ? (
          <>
            <HeaderButton a11y={closeLabel} onPress={closeTerminal} />
            <HeaderTitle text={title} />
          </>
        ) : (
          <>
            {footerTab === 'home' && webCanGoBack ? (
              <HeaderButton a11y="Back in web UI" onPress={() => webGoBack()} />
            ) : null}
            <XStack
              alignItems="center"
              gap={6}
              flex={1}
              minWidth={0}
              minHeight={HIT.minTouch}
              pressStyle={{ opacity: 0.7 }}
              onPress={agent ? () => setAgentsOpen(true) : undefined}
              accessibilityRole={agent ? 'button' : undefined}
              accessibilityLabel={agent ? `Agent ${agent.name}, switch agent` : undefined}
            >
              <LogoMark size={13} />
              <HeaderTitle text={title} />
              {agent ? (
                <>
                  <EngineDot state={agentState} />
                  <ArrowIcon dir="down" size={10} color={t.dim} />
                </>
              ) : null}
            </XStack>
          </>
        )}
      </XStack>

      <ReadingChip agentId={terminal?.agentId ?? agent?.id ?? null} />
      <CardMenu items={menuItems} label="Menu" offset={-24} />

      <Sheet
        open={aboutOpen}
        onOpenChange={setAboutOpen}
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
          <XStack alignItems="center" gap={6}>
            <LogoMark size={14} />
            <Text fontFamily="$mono" fontWeight="600" fontSize={17} letterSpacing={-0.3}>
              PhoneCanDo
            </Text>
          </XStack>
          <Text fontSize={15} color="$color10">
            On-device coding agents for Android. Home is the active agent's own UI, its web UI or
            its terminal UI; the ⋮ menu opens its terminal UI in any folder of its Linux home, or a
            shell in its machine.
          </Text>
          <AppButton
            variant="secondary"
            onPress={() => {
              setAboutOpen(false);
              setLicensesOpen(true);
            }}
          >
            Licenses
          </AppButton>
        </Sheet.Frame>
        <Sheet.Overlay />
      </Sheet>

      <LicensesDialog open={licensesOpen} onClose={() => setLicensesOpen(false)} />
      <AgentSheet open={agentsOpen} onClose={() => setAgentsOpen(false)} />
    </XStack>
  );
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
    onSelect: () => {
      act.goHome();
      if (kind.home === 'web') webGoHome();
    },
  };
  if (kind.home === 'tui') {
    return [home, { label: 'Open Linux shell', onSelect: () => act.openLinuxTerminal(agent.id) }];
  }
  return [home, { label: 'Open terminal UI', onSelect: act.openFolderPicker }];
}

// The terminal UI shows its folder; a Linux shell shows whose image it is in.
function terminalTitle(session: TerminalSession, agentName: string): string {
  if (session.kind === 'linux') return `${agentName} · Linux`;
  return session.dir.split('/').filter(Boolean).pop() ?? 'Terminal';
}

function HeaderButton({ a11y, onPress }: { a11y: string; onPress: () => void }) {
  return (
    <Button
      width={HIT.minTouch}
      height={HIT.minTouch}
      borderRadius={0}
      chromeless
      flexShrink={0}
      paddingHorizontal={0}
      justifyContent="center"
      alignItems="center"
      onPress={onPress}
      accessibilityLabel={a11y}
    >
      <BackIcon size={22} />
    </Button>
  );
}

// Mono title next to the logo mark: the active agent's name. The terminal
// view swaps it for what the terminal is attached to, without the mark.
function HeaderTitle({ text }: { text: string }) {
  return (
    <Text
      fontFamily="$mono"
      fontSize={17}
      fontWeight="600"
      letterSpacing={-0.3}
      numberOfLines={1}
      ellipsizeMode="tail"
      flexShrink={1}
      minWidth={0}
    >
      {text}
    </Text>
  );
}
