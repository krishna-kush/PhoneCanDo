import { Text } from 'tamagui';
import { useTheme } from '../../common/globals';

// One line of explanation (muted) or of trouble (red), at the size the other
// screens use for helper text.
export default function Note({ children, tone = 'muted' }: { children: string; tone?: 'muted' | 'error' }) {
  const t = useTheme();
  return (
    <Text fontSize={14} color={tone === 'error' ? t.primary : t.muted}>
      {children}
    </Text>
  );
}
