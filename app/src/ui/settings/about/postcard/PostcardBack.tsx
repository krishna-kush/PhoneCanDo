import { Text } from 'react-native';
import { XStack, YStack } from 'tamagui';
import StillFace from '../../../common/face/StillFace';
import { useTheme } from '../../../common/globals';
import PlainText from '../../../common/PlainText';
import Plate from '../../../common/Plate';
import { ROW_GUTTER } from '../../../common/rows/place';
import { AUTHOR, POSTCARD } from '../copy';
import { useAuthorLink } from './useAuthorLink';

// The spec plate's back, a postcard: our note (POSTCARD in ../copy.ts) in
// Android's handwriting face on the left, a stamp with A-01 on it and the
// address lines on the right, the handle opening the author's page. A tap
// anywhere else turns the plate back.
export default function PostcardBack({ onTurnBack }: { onTurnBack: () => void }) {
  const t = useTheme();
  const link = useAuthorLink();
  const hand = { fontFamily: 'cursive', fontSize: 19, lineHeight: 24, color: t.fg } as const;
  const addressed = { fontFamily: 'cursive', fontSize: 12, lineHeight: 15, color: t.fg } as const;
  return (
    <Plate
      flex={1}
      padding={ROW_GUTTER}
      gap="2"
      onPress={onTurnBack}
      accessibilityRole="button"
      accessibilityLabel={`A postcard to ${POSTCARD.address.join(', ')}: ${POSTCARD.lines.join(' ')} ${POSTCARD.signoff}. Tap to turn it back.`}
    >
      <XStack flex={1} gap="3">
        <YStack flex={1} gap="2" justifyContent="center" rotate="-1.5deg">
          {POSTCARD.lines.map((line) => (
            <Text key={line} style={hand}>
              {line}
            </Text>
          ))}
          <Text style={hand}>{POSTCARD.signoff}</Text>
          <YStack alignSelf="flex-start" onPress={link.open} hitSlop={12} accessibilityRole="link" accessibilityLabel={`${AUTHOR.name} on GitHub`}>
            <PlainText fontFamily="mono" fontSize={12} color="secondaryInk" textDecorationLine="underline">
              {`@${AUTHOR.handle}`}
            </PlainText>
          </YStack>
          {link.msg ? (
            <PlainText fontSize={12} color="muted">
              {link.msg}
            </PlainText>
          ) : null}
        </YStack>
        <YStack width={1} backgroundColor="line" />
        <YStack width={112} gap="3" alignItems="center">
          <YStack
            width={56}
            height={66}
            alignItems="center"
            justifyContent="center"
            gap={4}
            borderWidth={1.5}
            borderStyle="dashed"
            borderColor="primary"
            rotate="3deg"
          >
            <StillFace mood="happy" size={26} />
            <PlainText fontFamily="mono" fontSize={8} letterSpacing={1} color="primary">
              A-01
            </PlainText>
          </YStack>
          <YStack alignSelf="stretch" gap="2" paddingTop="1">
            {POSTCARD.address.map((line) => (
              <YStack key={line} borderBottomWidth={1} borderColor="lineStrong" paddingBottom={2}>
                <Text style={addressed} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {line}
                </Text>
              </YStack>
            ))}
          </YStack>
        </YStack>
      </XStack>
      <PlainText fontFamily="mono" fontSize={9} letterSpacing={1.4} textTransform="uppercase" color="faint" textAlign="center">
        Tap to turn back
      </PlainText>
    </Plate>
  );
}
