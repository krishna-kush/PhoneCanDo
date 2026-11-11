import { useState } from 'react';
import { Text } from 'tamagui';
import { useTheme } from '../globals';
import { wakingLine } from './lines';

// A-01's caption under a loader while an agent starts: one line per start,
// under the plain words, never instead of them.
export default function WakingLine() {
  const t = useTheme();
  const [seed] = useState(() => Math.floor(Math.random() * 1000));
  return (
    <Text fontFamily="mono" fontSize={11} letterSpacing={1.4} color={t.dim} textTransform="uppercase">
      {`A-01 · ${wakingLine(seed)}`}
    </Text>
  );
}
