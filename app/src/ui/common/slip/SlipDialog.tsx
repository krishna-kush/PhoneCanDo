import type { ReactNode } from 'react';
import { Modal } from 'react-native';
import { YStack } from 'tamagui';
import Hazard from '../actions/Hazard';
import type { BarcodeId } from '../rows/barcode/lines';
import KeyHead from '../rows/KeyHead';
import { SLIP_TITLE } from './copy';

type Props = {
  open: boolean;
  /** Android's back, and a tap on the dim around it when `scrimCloses`. */
  onClose: () => void;
  scrimCloses?: boolean;
  /** A question an agent asks: the permission slip's strip, with its own barcode line. */
  slip?: BarcodeId;
  /** Something that can't be undone: hazard tape across its top. */
  hazard?: boolean;
  children: ReactNode;
};

// Every pop-up's frame: centred on a dim backdrop, a panel card the width
// of the phone up to 360. An agent's question is a permission slip (the
// figure key's strip, titled Permission slip, with its barcode); a delete
// has hazard tape across its top; the rest are the plain card. Its keys
// are the deck's (DeckKeys), as on every page.
export default function SlipDialog({ open, onClose, scrimCloses = false, slip, hazard = false, children }: Props) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <YStack
        flex={1}
        backgroundColor="scrimSoft"
        alignItems="center"
        justifyContent="center"
        padding="5"
        onPress={scrimCloses ? onClose : undefined}
      >
        {/* A tap on the card is not a tap on the dim. */}
        <YStack
          onPress={scrimCloses ? () => {} : undefined}
          backgroundColor="panel"
          borderWidth={1}
          borderColor="lineStrong"
          width="100%"
          maxWidth={360}
          overflow="hidden"
        >
          {slip ? <KeyHead title={SLIP_TITLE} barcode={slip} /> : null}
          {hazard ? (
            <YStack height={12}>
              <Hazard />
            </YStack>
          ) : null}
          <YStack padding="4" gap="3">
            {children}
          </YStack>
        </YStack>
      </YStack>
    </Modal>
  );
}
