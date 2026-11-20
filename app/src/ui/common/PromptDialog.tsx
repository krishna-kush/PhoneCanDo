import { Text } from 'tamagui';
import DeckKeys from './actions/DeckKeys';
import AppInput from './AppInput';
import SlipDialog from './slip/SlipDialog';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  placeholder?: string;
  confirmLabel?: string;
  value: string;
  onChangeText: (t: string) => void;
  onConfirm: () => void;
};

// Text-input dialog in the ConfirmDialog style (centered modal, not a bottom
// sheet), plain: no mascot, the deck's keys. Used for create/rename prompts
// so they all look identical.
export default function PromptDialog({
  open,
  onClose,
  title,
  placeholder = 'Name',
  confirmLabel = 'Create',
  value,
  onChangeText,
  onConfirm,
}: Props) {
  return (
    <SlipDialog open={open} onClose={onClose}>
      <Text fontSize={19} fontWeight="700">
        {title}
      </Text>
      <AppInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoFocus
        onSubmitEditing={onConfirm}
        returnKeyType="done"
      />
      <DeckKeys
        actions={[
          { label: confirmLabel, role: 'go', mark: 'save', onPress: onConfirm },
          { label: 'Cancel', role: 'back', onPress: onClose },
        ]}
      />
    </SlipDialog>
  );
}
