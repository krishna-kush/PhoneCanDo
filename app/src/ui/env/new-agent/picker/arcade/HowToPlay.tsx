import { useState } from 'react';
import { Linking } from 'react-native';
import { XStack, YStack } from 'tamagui';
import PlainText from '../../../../common/PlainText';
import Note from '../../../parts/Note';
import { HOW_TO_PLAY, openElsewhere } from '../copy';
import type { PlayLink } from '../logic/howToPlay';
import Term from './Term';

// How to play: the picked applicant's official pages (its guide, where to
// get a key, its plans, its website) as small printed tabs that open in
// the browser, the ↗ in amber; when no app opens one, the address to type.
export default function HowToPlay({ links }: { links: readonly PlayLink[] }) {
  const [msg, setMsg] = useState('');
  const open = (url: string) => {
    setMsg('');
    Linking.openURL(url).catch(() => setMsg(openElsewhere(url)));
  };
  return (
    <YStack gap={8}>
      <Term wide>{HOW_TO_PLAY}</Term>
      <XStack gap={8} flexWrap="wrap">
        {links.map((l) => (
          <XStack
            key={l.key}
            gap={6}
            alignItems="center"
            paddingHorizontal={10}
            paddingVertical={7}
            borderWidth={1}
            borderColor="lineStrong press:secondaryLine"
            backgroundColor="panel press:secondarySoft"
            onPress={() => open(l.url)}
            accessibilityRole="link"
            accessibilityLabel={l.label}
            accessibilityHint="Opens in your browser"
          >
            <PlainText fontFamily="mono" fontSize={11} fontWeight="500" letterSpacing={1} textTransform="uppercase">
              {l.label}
            </PlainText>
            <PlainText fontFamily="mono" fontSize={12} color="secondaryInk">
              ↗
            </PlainText>
          </XStack>
        ))}
      </XStack>
      {msg ? <Note>{msg}</Note> : null}
    </YStack>
  );
}
