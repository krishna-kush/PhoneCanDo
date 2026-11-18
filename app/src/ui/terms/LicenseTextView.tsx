import { Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { YStack } from 'tamagui';
import AppButton from '../common/AppButton';
import { useTheme } from '../common/globals';
import PlainText from '../common/PlainText';
import Screen from '../common/Screen';
import SectionTitle from '../common/SectionTitle';
import { CLOSE, TEXT_HEAD, TEXT_NOTE } from './copy';
import LicenseBody from './parts/LicenseBody';

// Our license in full, a page of its own so it stays readable on a small
// phone (as the third-party Licenses are): the license gate's Read the
// license and About's row open it. Back or Close shuts it.
export default function LicenseTextView({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme();
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'bottom', 'left', 'right']}>
        <Screen scroll={false} pillClearance={false}>
          <SectionTitle>{TEXT_HEAD}</SectionTitle>
          <PlainText fontSize={13} color="muted" lineHeight="19px">
            {TEXT_NOTE}
          </PlainText>
          <YStack flex={1} minHeight={0}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
              <LicenseBody />
            </ScrollView>
          </YStack>
          <AppButton variant="secondary" onPress={onClose}>
            {CLOSE}
          </AppButton>
        </Screen>
      </SafeAreaView>
    </Modal>
  );
}
