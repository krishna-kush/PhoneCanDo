import Svg, { Path, Rect } from 'react-native-svg';
import type { DeckRole } from './logic/deal';

// A key's small mark, drawn rather than typed (▶ and ✕ turn into emoji
// on some phones): a play triangle to go, a square for another act, a
// chevron back, a cross to delete.
export default function KeyGlyph({ role, color, size = 10 }: { role: DeckRole; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10">
      {role === 'go' ? (
        <Path d="M2 1 L9 5 L2 9 Z" fill={color} />
      ) : role === 'back' ? (
        <Path d="M7 1 L3 5 L7 9" stroke={color} strokeWidth={1.8} fill="none" />
      ) : role === 'danger' ? (
        <Path d="M2 2 L8 8 M8 2 L2 8" stroke={color} strokeWidth={1.8} />
      ) : (
        <Rect x={2.5} y={2.5} width={5} height={5} fill={color} />
      )}
    </Svg>
  );
}
