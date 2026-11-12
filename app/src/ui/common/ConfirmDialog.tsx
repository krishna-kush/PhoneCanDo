import { Modal } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import AppButton from './AppButton';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  /** The button that only closes it, when "Cancel" says too little (the choice it leaves you with). */
  cancelLabel?: string;
  onConfirm: () => void;
};

// Centered confirm dialog (not a bottom sheet): dimmed backdrop, panel card,
// destructive + cancel side by side. Used for every delete/remove confirm,
// and for a choice worth a second look (sharing a machine), so they all
// look and behave identically. Android back dismisses via onRequestClose.
export default function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
}: Props) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <YStack
        flex={1}
        backgroundColor="rgba(0,0,0,0.6)"
        alignItems="center"
        justifyContent="center"
        padding="5"
        onPress={onClose}
      >
        <YStack
          backgroundColor="panel"
          borderWidth={1}
          borderColor="lineStrong"
          borderRadius={0}
          padding="4"
          gap="3"
          width="100%"
          maxWidth={360}
        >
          <Text fontSize={19} fontWeight="700">
            {title}
          </Text>
          {message ? (
            <Text fontSize={15} color="color10">
              {message}
            </Text>
          ) : null}
          <XStack gap="2" marginTop="2">
            <AppButton variant="secondary" flex={1} onPress={onClose}>
              {cancelLabel}
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
