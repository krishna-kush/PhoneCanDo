import { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import type { AgentId } from '../../../engine/agents/records';
import RowFrame from '../../common/rows/RowFrame';
import RowGroup from '../../common/rows/RowGroup';
import TextAction from '../../drawer/select/TextAction';
import AgentLine from '../AgentLine';
import type { TimelineAgent } from '../logic/timeline';

type Props = {
  /** Its box's title (the field's name). */
  title: string;
  agents: readonly TimelineAgent[];
  value: AgentId | null;
  onPick: (id: AgentId) => void;
};

// Which agent a new schedule is for, a pick-one RowGroup: the agents that
// can run schedules, each as the drawer shows it (face, name, serial,
// kind, state). Once one is picked the list folds to it, wearing the
// picked row's red bar, with Change to open the list again, so a phone
// with many agents keeps the task and the time in view.
export default function AgentPicker({ title, agents, value, onPick }: Props) {
  const [open, setOpen] = useState(value == null);
  const picked = agents.find((a) => a.id === value) ?? null;
  const shown = open || !picked ? agents : [picked];
  return (
    <YStack gap="2">
      <RowGroup title={title} radio>
        {shown.map((a) => {
          const on = a.id === value;
          return (
            <RowFrame
              key={a.id}
              press={{
                onPress: () => {
                  onPick(a.id);
                  setOpen(false);
                },
                role: 'radio',
                label: a.name,
                state: { checked: on },
              }}
              picked={on}
            >
              <AgentLine agentId={a.id} agent={a} />
            </RowFrame>
          );
        })}
      </RowGroup>
      {!open && picked && agents.length > 1 ? (
        <XStack>
          <TextAction label="Change" onPress={() => setOpen(true)} />
        </XStack>
      ) : null}
    </YStack>
  );
}
