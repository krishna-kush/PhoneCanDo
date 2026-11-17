import { useState } from 'react';
import { Linking } from 'react-native';
import { YStack } from 'tamagui';
import PlainText from '../../common/PlainText';

// The release's notes on GitHub, as a line on the parcel's label that
// opens them in the browser; when no app opens it, the address to type.
export default function ReleaseLink({ url }: { url: string }) {
  const [msg, setMsg] = useState('');
  const open = () => {
    setMsg('');
    Linking.openURL(url).catch(() => setMsg(`Open ${url} in a browser.`));
  };
  return (
    <YStack gap="1">
      <YStack alignSelf="flex-start" paddingVertical="1" onPress={open} accessibilityRole="link" accessibilityLabel="Release notes on GitHub">
        <PlainText fontFamily="mono" fontSize={12} color="primary">
          Release notes on GitHub ›
        </PlainText>
      </YStack>
      {msg ? (
        <PlainText fontSize={12} color="dim">
          {msg}
        </PlainText>
      ) : null}
    </YStack>
  );
}
