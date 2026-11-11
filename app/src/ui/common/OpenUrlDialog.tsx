import { useEffect, useState } from 'react';
import { Linking, Modal } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import * as runner from '../../engine/runner';
import type { OpenUrlAction } from '../../engine/runner';
import AppButton from './AppButton';
import { isWebLink, openUrlTitle, waitingLine } from './promptQueue';
import { markAnswered, useBridgePrompts } from './useBridgePrompts';

// An agent wants a link opened on the phone, most often a sign-in its
// program started (the kit's phonecando-open, its BROWSER). Nothing opens
// without the user: Open hands the link to Android, Copy puts it on the
// clipboard (native does it; it holds the link), Not now drops it. It shows
// when the oldest waiting prompt is a link, over whatever tab is open.
export default function OpenUrlDialog() {
  const { current, queue } = useBridgePrompts();
  const prompt = current?.kind === 'open_url' ? current : null;
  const requestId = prompt?.requestId;
  const url = prompt?.url ?? '';
  const [msg, setMsg] = useState('');

  useEffect(() => setMsg(''), [requestId]);

  function answer(action: OpenUrlAction) {
    if (!requestId) return;
    runner.resolveOpenUrl(requestId, action);
    markAnswered([requestId]);
  }

  // A copy that did not reach the clipboard keeps the dialog; the link
  // above can still be selected by hand.
  function copy() {
    if (!requestId) return;
    if (runner.resolveOpenUrl(requestId, 'copy')) markAnswered([requestId]);
    else setMsg("We couldn't copy it. Press and hold the link above to copy it.");
  }

  function open() {
    Linking.openURL(url).then(
      () => answer('open'),
      () => setMsg('No app on this phone opens this link. Copy it instead.'),
    );
  }

  function close() {
    answer('dismiss');
  }

  const note = waitingLine(queue.length - 1);

  return (
    <Modal visible={prompt !== null} transparent animationType="fade" onRequestClose={close}>
      <YStack flex={1} backgroundColor="rgba(0,0,0,0.6)" alignItems="center" justifyContent="center" padding="5">
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
            {prompt ? openUrlTitle(prompt) : 'Open a link'}
          </Text>
          <Text fontFamily="mono" fontSize={12} color="dim" numberOfLines={6} userSelect="text">
            {url}
          </Text>
          <Text fontSize={13} color="color10">
            Open it only if you expect it, for example a sign-in you started with this agent.
          </Text>
          {note ? (
            <Text fontSize={13} color="color10">
              {note}
            </Text>
          ) : null}
          {msg ? (
            <Text fontSize={13} color="color10">
              {msg}
            </Text>
          ) : null}
          <XStack gap="2" marginTop="2">
            <AppButton variant="secondary" flex={1} onPress={close}>
              Not now
            </AppButton>
            <AppButton variant="secondary" flex={1} onPress={copy}>
              Copy
            </AppButton>
            <AppButton flex={1} disabled={!isWebLink(url)} onPress={open}>
              Open
            </AppButton>
          </XStack>
        </YStack>
      </YStack>
    </Modal>
  );
}
