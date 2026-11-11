import { XStack, YStack } from 'tamagui';
import type { Fact } from '../logic/systemFacts';
import PlainText from '../../common/PlainText';

// A system's facts as a two-column table: the label in mono on the left,
// the value on the right, hairlines between.
export default function SystemFacts({ facts }: { facts: Fact[] }) {
  return (
    <YStack borderWidth={1} borderColor="line" backgroundColor="panel">
      {facts.map((f, i) => (
        <XStack
          key={f.label}
          alignItems="center"
          gap="3"
          minHeight={44}
          paddingHorizontal="3"
          borderTopWidth={i > 0 ? 1 : 0}
          borderColor="line"
        >
          <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} color="dim" textTransform="uppercase" width={84}>
            {f.label}
          </PlainText>
          <PlainText fontSize={15} flex={1} minWidth={0} numberOfLines={2} userSelect="text">
            {f.value}
          </PlainText>
        </XStack>
      ))}
    </YStack>
  );
}
