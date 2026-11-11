import { YStack } from 'tamagui';
import type { LocalModel } from '../../../engine/models/types';
import { modelChoices } from '../logic/choices';
import ChoiceRow from './ChoiceRow';

type Props = {
  models: LocalModel[];
  /** The model picked; null: the agent's own setup. */
  selected: string | null;
  disabled?: boolean;
  onSelect: (id: string | null) => void;
};

// The Model choices as one pick-one list: the agent page's Model section
// and a new agent's Model step.
export default function ModelPicker({ models, selected, disabled = false, onSelect }: Props) {
  return (
    <YStack gap="2" accessibilityRole="radiogroup">
      {modelChoices(models, selected).map((c) => (
        <ChoiceRow
          key={c.id ?? 'own'}
          label={c.label}
          note={c.note}
          dates={c.dates}
          selected={c.id === selected}
          disabled={c.disabled || disabled}
          onPress={() => onSelect(c.id)}
        />
      ))}
    </YStack>
  );
}
