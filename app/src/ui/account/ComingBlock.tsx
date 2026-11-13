import { XStack, YStack } from 'tamagui';
import PlainText from '../common/PlainText';
import SectionTitle from '../common/SectionTitle';
import { COMING, COMING_LINE, COMING_TITLE } from './copy';

// What sign-in is for next: features that will need an account and stay
// optional, numbered like the site's field-manual lists. Shown signed in or out.
export default function ComingBlock() {
  return (
    <YStack gap="3">
      <SectionTitle>{COMING_TITLE}</SectionTitle>
      <PlainText fontSize={13} color="muted">
        {COMING_LINE}
      </PlainText>
      {COMING.map((f, i) => (
        <XStack key={f.title} gap="3" alignItems="flex-start">
          <YStack width={22} paddingTop={3}>
            <PlainText fontFamily="mono" fontSize={11} color="primary">
              {String(i + 1).padStart(2, '0')}
            </PlainText>
          </YStack>
          <YStack flex={1} gap="1">
            <PlainText fontSize={15} fontWeight="600" color="fg">
              {f.title}
            </PlainText>
            <PlainText fontSize={13} color="muted">
              {f.line}
            </PlainText>
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}
