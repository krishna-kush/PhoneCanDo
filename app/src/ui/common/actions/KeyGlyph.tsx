import Svg, { Path, Rect } from 'react-native-svg';
import type { DeckRole } from './logic/deal';
import type { KeyMark } from './types';

// A key's small mark, drawn rather than typed (▶ and ✕ turn into emoji
// on some phones). The main key's says what it does (its `mark`): a play
// triangle to start or run something, a prompt for a terminal, a plus to
// add, a tick to save or agree, an arrow for anything else. The others: a
// square for another act, a chevron back, a cross to delete.
export default function KeyGlyph({ role, mark, color, size = 10 }: { role: DeckRole; mark?: KeyMark | null; color: string; size?: number }) {
  const line = { stroke: color, strokeWidth: 1.8, fill: 'none' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10">
      {role === 'go' ? (
        <MainMark mark={mark ?? 'next'} color={color} />
      ) : role === 'back' ? (
        <Path d="M7 1 L3 5 L7 9" {...line} />
      ) : role === 'danger' ? (
        <Path d="M2 2 L8 8 M8 2 L2 8" {...line} />
      ) : (
        <Rect x={2.5} y={2.5} width={5} height={5} fill={color} />
      )}
    </Svg>
  );
}

function MainMark({ mark, color }: { mark: KeyMark; color: string }) {
  const line = { stroke: color, strokeWidth: 1.6, fill: 'none' } as const;
  switch (mark) {
    case 'play':
      return <Path d="M2 1 L9 5 L2 9 Z" fill={color} />;
    case 'terminal':
      return <Path d="M1 2 L4.5 5 L1 8 M5.5 8.5 H9.5" {...line} />;
    case 'add':
      return <Path d="M5 1 V9 M1 5 H9" {...line} strokeWidth={1.8} />;
    case 'save':
      return <Path d="M1.2 5.4 L3.9 8 L8.8 2" {...line} strokeWidth={1.8} />;
    case 'next':
      return <Path d="M1 5 H8.5 M5.5 2 L8.5 5 L5.5 8" {...line} />;
  }
}
