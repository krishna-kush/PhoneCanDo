import { XStack } from 'tamagui';
import PlainText from '../common/PlainText';
import { unreadMark } from './logic/messagesCopy';

// A small square with an agent's unread messages beside its name (the
// drawer's rows); nothing with none. The row's own label says the count to
// a screen reader.
export default function UnreadMark({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <XStack
      flexShrink={0}
      minWidth={18}
      height={18}
      paddingHorizontal={4}
      alignItems="center"
      justifyContent="center"
      backgroundColor="primary"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <PlainText fontFamily="mono" fontSize={11} fontWeight="600" color="onPrimary">
        {unreadMark(count)}
      </PlainText>
    </XStack>
  );
}
