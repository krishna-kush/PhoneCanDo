import { ActivityIndicator } from 'react-native';
import ChevronIcon from './ChevronIcon';
import { useTheme } from './globals';

// The › of a row that opens a page, or, while that page is being built
// (nav/opening.ts), a circular spinner of the same size and ink in its
// place, so the tap shows at once. Android's own spinner: it turns on the
// UI thread while JS is busy with the page.
export default function OpenMark({ opening, size, color }: { opening: boolean; size: number; color?: string }) {
  const t = useTheme();
  if (opening) return <ActivityIndicator size={size} color={color ?? t.fg} />;
  return <ChevronIcon size={size} color={color} />;
}
