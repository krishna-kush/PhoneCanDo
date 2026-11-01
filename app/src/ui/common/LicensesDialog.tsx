import { Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, YStack } from 'tamagui';
import AppButton from './AppButton';
import Screen from './Screen';
import SectionTitle from './SectionTitle';
import { useTheme } from './globals';
import { LICENSES } from './licenses';

// Full-screen so the long OFL text stays readable and scrollable on small
// phones. Opened from the About sheet in AppHeader.
export default function LicensesDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTheme();
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'bottom', 'left', 'right']}>
        <Screen scroll={false} fabClearance={false}>
          <SectionTitle>Licenses</SectionTitle>
          <Text fontSize={13} color={t.muted} lineHeight={19}>
            PhoneCanDo bundles the components below. Their licenses require these notices to travel
            with the app.
          </Text>
          <YStack flex={1} minHeight={0}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
              <Text fontSize={12} color={t.muted} lineHeight={18} selectable>
                {LICENSES}
              </Text>
            </ScrollView>
          </YStack>
          <AppButton variant="secondary" onPress={onClose}>
            Close
          </AppButton>
        </Screen>
      </SafeAreaView>
    </Modal>
  );
}
