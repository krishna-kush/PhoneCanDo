import { Modal } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import AppButton from './AppButton';
import AppInput from './AppInput';
import { useTheme } from './globals';

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
// sheet). Used for create/rename prompts so they all look identical.
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
  const t = useTheme();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <YStack
        flex={1}
        backgroundColor="rgba(0,0,0,0.6)"
        alignItems="center"
        justifyContent="center"
        padding="$5"
      >
        <YStack
          backgroundColor={t.panel}
          borderWidth={1}
          borderColor={t.lineStrong}
          borderRadius={0}
          padding="$4"
          gap="$3"
          width="100%"
          maxWidth={360}
        >
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
          <XStack gap="$2" marginTop="$2">
            <AppButton variant="secondary" flex={1} onPress={onClose}>
              Cancel
            </AppButton>
            <AppButton flex={1} onPress={onConfirm}>
              {confirmLabel}
            </AppButton>
          </XStack>
        </YStack>
      </YStack>
    </Modal>
  );
}
