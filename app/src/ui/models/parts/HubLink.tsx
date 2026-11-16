import { useState } from 'react';
import { Linking } from 'react-native';
import { YStack } from 'tamagui';
import AppButton from '../../common/AppButton';
import Note from '../../env/parts/Note';
import { openElsewhere } from '../logic/hubLinks';

type Props = { label: string; url: string };

// A Hugging Face page opened in the browser (a model card, the token
// settings), as a ghost button; when no app opens it, the address to type.
export default function HubLink({ label, url }: Props) {
  const [msg, setMsg] = useState('');
  const open = () => {
    setMsg('');
    Linking.openURL(url).catch(() => setMsg(openElsewhere(url)));
  };
  return (
    <YStack gap="1" alignItems="flex-start">
      <AppButton variant="ghost" onPress={open}>
        {label}
      </AppButton>
      {msg ? <Note>{msg}</Note> : null}
    </YStack>
  );
}
