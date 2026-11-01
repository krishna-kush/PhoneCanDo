import { Modal } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import AppButton from './AppButton';
import { useTheme } from './globals';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  onConfirm: () => void;
};

// Centered confirm dialog (not a bottom sheet): dimmed backdrop, panel card,
// destructive + cancel side by side. Used for every delete/remove confirm so
// they all look and behave identically. Android back dismisses via
// onRequestClose.
export default function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel = 'Delete',
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
        onPress={onClose}
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
          {message ? (
            <Text fontSize={15} color="$color10">
              {message}
            </Text>
          ) : null}
          <XStack gap="$2" marginTop="$2">
            <AppButton variant="secondary" flex={1} onPress={onClose}>
              Cancel
            </AppButton>
            <AppButton variant="danger" flex={1} onPress={onConfirm}>
              {confirmLabel}
            </AppButton>
          </XStack>
        </YStack>
      </YStack>
    </Modal>
  );
}
