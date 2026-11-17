import { useState } from 'react';
import { YStack } from 'tamagui';
import type { AgentId } from '../../../engine/agents/records';
import RowFrame from '../../common/rows/RowFrame';
import TextAction from '../../drawer/select/TextAction';
import AgentLine from '../AgentLine';
import { FOR_LABEL } from '../logic/editorCopy';
import type { FaceCue } from '../logic/faceCue';
import type { TimelineAgent } from '../logic/timeline';
import Field from './Field';

type Props = {
  agents: readonly TimelineAgent[];
  value: AgentId | null;
  onPick: (id: AgentId) => void;
  problems: readonly string[];
  /** The picked one's face for a moment (faceCue), and its hops so far. */
  face: FaceCue;
  hop: number;
};

// Who a new work order is for, a pick-one list in the ticket's first
// field: the agents that can run schedules, each as the drawer shows it
// (face, name, serial, kind, state). Once one is picked the list folds to
// it, wearing the picked row's red bar, and Change by the field's label
// opens it again, so a phone with many agents keeps the task and the time
// in view. The picked one's face reacts to the form (faceCue).
export default function AgentPicker({ agents, value, onPick, problems, face, hop }: Props) {
  const [open, setOpen] = useState(value == null);
  const picked = agents.find((a) => a.id === value) ?? null;
  const shown = open || !picked ? agents : [picked];
  const canChange = !open && picked != null && agents.length > 1;
  return (
    <Field
      label={FOR_LABEL}
      rows
      problems={problems}
      trailing={canChange ? <TextAction label="Change" onPress={() => setOpen(true)} /> : undefined}
    >
      <YStack accessibilityRole="radiogroup">
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
              <AgentLine agentId={a.id} agent={a} size={28} {...(on ? { ...face, hop } : null)} />
            </RowFrame>
          );
        })}
      </YStack>
    </Field>
  );
}
