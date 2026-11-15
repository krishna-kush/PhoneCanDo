import { useState } from 'react';
import { Linking } from 'react-native';
import { YStack } from 'tamagui';
import AppButton from '../../../common/AppButton';
import { ACP_NONE_NOTE, ADD_AGENT_GUIDE, openElsewhere } from '../../logic/customAgentText';
import Note from '../../parts/Note';

// Under the ACP command, always: an agent without an ACP mode can still be
// added to our repo, and the guide that says how, opened in the browser
// (Settings' privacy details open the same way).
export default function AcpNote() {
  const [msg, setMsg] = useState('');
  const open = () => {
    Linking.openURL(ADD_AGENT_GUIDE.url).catch(() => setMsg(openElsewhere(ADD_AGENT_GUIDE.url)));
  };
  return (
    <YStack gap="1">
      <Note>{ACP_NONE_NOTE}</Note>
      <YStack alignItems="flex-start">
        <AppButton variant="ghost" onPress={open}>
          {ADD_AGENT_GUIDE.label}
        </AppButton>
      </YStack>
      {msg ? <Note>{msg}</Note> : null}
    </YStack>
  );
}
