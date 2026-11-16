import { useState } from 'react';
import { Linking } from 'react-native';
import { YStack } from 'tamagui';
import AppButton, { BUTTON_PAD_X } from '../../common/AppButton';
import Note from '../../env/parts/Note';
import { openElsewhere } from '../logic/hubLinks';

type Props = {
  label: string;
  url: string;
  /** Centred under a panel's actions; else at the start, under a header. */
  centered?: boolean;
};

// A Hugging Face page opened in the browser (a model card, the token
// settings), as a ghost button; when no app opens it, the address to type.
// At the start it pulls back by the button's padding, so its words line up
// with the title above while the whole button still takes the press.
export default function HubLink({ label, url, centered }: Props) {
  const [msg, setMsg] = useState('');
  const open = () => {
    setMsg('');
    Linking.openURL(url).catch(() => setMsg(openElsewhere(url)));
  };
  return (
    <YStack gap="1" alignItems={centered ? 'center' : 'flex-start'}>
      <YStack marginLeft={centered ? 0 : -BUTTON_PAD_X}>
        <AppButton variant="ghost" onPress={open}>
          {label}
        </AppButton>
      </YStack>
      {msg ? <Note>{msg}</Note> : null}
    </YStack>
  );
}
