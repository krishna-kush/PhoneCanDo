import { useEffect } from 'react';
import { Keyboard } from 'react-native';
import { Sheet, YStack } from 'tamagui';
import { agentKind } from '../../../engine/agents/registry';
import { useAgentsStore } from '../../../state/agents';
import { useAppStore } from '../../../state/app';
import AppButton from '../AppButton';
import AppCard from '../AppCard';
import SectionTitle from '../SectionTitle';
import { useTheme } from '../globals';
import EngineDot from './EngineDot';
import { engineDot } from './engineDot';

// The header's agent switcher: every agent with its engine state; a tap
// makes it the active agent (chat pairs with it, the terminal UI attaches
// to it). Creating and deleting agents lives on the Env tab.
export default function AgentSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme();
  const agents = useAgentsStore((s) => s.agents);
  const statuses = useAgentsStore((s) => s.statuses);
  const activeAgentId = useAgentsStore((s) => s.activeAgentId);
  const setActiveAgent = useAgentsStore((s) => s.setActiveAgent);
  const setFooterTab = useAppStore((s) => s.setFooterTab);
  const setFolderPickerOpen = useAppStore((s) => s.setFolderPickerOpen);

  // A TUI home keeps the keyboard up for its hidden input; the sheet rises
  // from the bottom, so the keyboard would cover it.
  useEffect(() => {
    if (open) Keyboard.dismiss();
  }, [open]);

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
        <SectionTitle>Agents</SectionTitle>
        <YStack gap="$2">
          {agents.map((agent) => {
            const state = statuses[agent.id]?.state;
            return (
              <AppCard
                key={agent.id}
                title={agent.name}
                subtitle={`${agentKind(agent.kind).label} · ${engineDot(state).label}`}
                icon={<EngineDot state={state} size={12} />}
                selected={agent.id === activeAgentId}
                chevron={false}
                onPress={() => {
                  onClose();
                  void setActiveAgent(agent.id);
                }}
              />
            );
          })}
        </YStack>
        <AppButton
          variant="secondary"
          onPress={() => {
            onClose();
            setFolderPickerOpen(false);
            setFooterTab('env');
          }}
        >
          Manage agents
        </AppButton>
      </Sheet.Frame>
      <Sheet.Overlay />
    </Sheet>
  );
}
