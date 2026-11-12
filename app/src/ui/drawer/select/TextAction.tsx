import { Pressable } from 'react-native';
import PlainText from '../../common/PlainText';

// The selection's small word buttons (Select, All, None, Cancel): mono
// uppercase in the accent, sized like the labels beside them. The press
// area reaches past the word (as LinkRow's `reach`), so it stays a full
// touch target without making the line taller.
const REACH = { x: 10, y: 14 };

export default function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        marginHorizontal: -REACH.x,
        marginVertical: -REACH.y,
        paddingHorizontal: REACH.x,
        paddingVertical: REACH.y,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <PlainText
        fontFamily="mono"
        fontSize={11}
        fontWeight="600"
        letterSpacing={1.4}
        color="primary"
        textTransform="uppercase"
      >
        {label}
      </PlainText>
    </Pressable>
  );
}
