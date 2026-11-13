import type { ReactNode } from 'react';
import { type LayoutChangeEvent, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  children: ReactNode;
  backgroundColor: string;
  onLayout?: (e: LayoutChangeEvent) => void;
};

// The app's box inside the system bars, padded from the provider's insets
// (the same ones KeyboardTracker and the sheets read). Not the library's
// SafeAreaView: on Android its padding is native shadow-node state, and a
// re-render could commit it at zero (the header then sat under the status
// bar until the insets next changed). Mounted once, inside SafeAreaProvider.
export default function SafeRoot({ children, backgroundColor, onLayout }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
      onLayout={onLayout}
    >
      {children}
    </View>
  );
}
