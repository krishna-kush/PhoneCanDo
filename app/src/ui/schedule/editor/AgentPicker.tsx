import { Fragment, useState } from 'react';
import { Pressable } from 'react-native';
import { XStack, YStack } from 'tamagui';
import type { AgentId } from '../../../engine/agents/records';
import { HIT, useTheme } from '../../common/globals';
import TextAction from '../../drawer/select/TextAction';
import AgentLine from '../AgentLine';
import type { TimelineAgent } from '../logic/timeline';

type Props = {
  agents: readonly TimelineAgent[];
  value: AgentId | null;
  onPick: (id: AgentId) => void;
};

// Which agent a new schedule is for: the agents that can run schedules,
// each as the drawer shows it (face, name, serial, kind, state). Once one
// is picked the list folds to it, outlined as the drawer outlines the
// active agent, with Change to open the list again, so a phone with many
// agents keeps the task and the time in view.
export default function AgentPicker({ agents, value, onPick }: Props) {
  const t = useTheme();
  const [open, setOpen] = useState(value == null);
  const picked = agents.find((a) => a.id === value) ?? null;
  const shown = open || !picked ? agents : [picked];
  return (
    <YStack gap="2">
      <YStack borderWidth={1} borderColor="line" accessibilityRole="radiogroup">
        {shown.map((a, i) => {
          const on = a.id === value;
          return (
            <Fragment key={a.id}>
              {i > 0 ? <YStack height={1} backgroundColor="line" /> : null}
              <Pressable
                onPress={() => {
                  onPick(a.id);
                  setOpen(false);
                }}
                android_ripple={{ color: t.line }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={a.name}
              >
                <YStack
                  minHeight={HIT.buttonH}
                  justifyContent="center"
                  paddingHorizontal="3"
                  paddingVertical="2"
                  borderWidth={1}
                  borderColor={on ? 'primary' : 'transparent'}
                  backgroundColor={on ? 'primarySoft' : 'transparent'}
                >
                  <AgentLine agentId={a.id} agent={a} />
                </YStack>
              </Pressable>
            </Fragment>
          );
        })}
      </YStack>
      {!open && picked && agents.length > 1 ? (
        <XStack>
          <TextAction label="Change" onPress={() => setOpen(true)} />
        </XStack>
      ) : null}
    </YStack>
  );
}
