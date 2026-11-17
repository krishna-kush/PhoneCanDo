import PlainText from '../../../../common/PlainText';

/** The terms' column, in dp, so the showcase's rows keep one edge. */
export const TERM_W = 92;

// A showcase row's term, in faint mono capitals as a stat screen prints
// it; in the terms' column unless `wide` (a section's head).
export default function Term({ children, wide = false }: { children: string; wide?: boolean }) {
  return (
    <PlainText
      fontFamily="mono"
      fontSize={10}
      fontWeight="500"
      letterSpacing={1.2}
      textTransform="uppercase"
      color="faint"
      width={wide ? undefined : TERM_W}
    >
      {children}
    </PlainText>
  );
}
