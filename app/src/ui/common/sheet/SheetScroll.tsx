import { useContext, type ReactNode } from 'react';
import { ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { ScrollSlot } from './scrollSlot';

type Props = {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

// The part of a sheet's panel that scrolls when it runs long. The sheet
// knows it by its ref, so Android hands a drag between the two: the list
// scrolls first, and once it is at its top a drag down moves the sheet.
export default function SheetScroll({ children, contentContainerStyle }: Props) {
  const slot = useContext(ScrollSlot);
  return (
    <ScrollView ref={slot ?? undefined} contentContainerStyle={contentContainerStyle}>
      {children}
    </ScrollView>
  );
}
