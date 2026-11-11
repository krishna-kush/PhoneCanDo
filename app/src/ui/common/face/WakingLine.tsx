import { useState } from 'react';
import { wakingLine } from './lines';
import PlainText from '../PlainText';

// A-01's caption under a loader while an agent starts: one line per start,
// under the plain words, never instead of them.
export default function WakingLine() {
  const [seed] = useState(() => Math.floor(Math.random() * 1000));
  return (
    <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.4} color="dim" textTransform="uppercase">
      {`A-01 · ${wakingLine(seed)}`}
    </PlainText>
  );
}
