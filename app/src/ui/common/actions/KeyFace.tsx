import type { Theme } from '../globals';
import { useTheme } from '../globals';
import LogoLoader from '../LogoLoader';
import PlainText from '../PlainText';
import KeyGlyph from './KeyGlyph';
import type { DeckRole } from './logic/deal';

type Props = {
  label: string;
  role: DeckRole;
  /** The label's ink, a palette role. */
  ink: keyof Theme;
  /** The glyph's, when not the label's. */
  glyphInk?: keyof Theme;
  loading?: boolean;
  /** The main key's bigger label. */
  big?: boolean;
  /** Leave the glyph to the look (it draws its own). */
  bare?: boolean;
};

// What a deck's key shows: its glyph (or, while busy, the small logo
// loader) and its label in mono capitals, as AppButton's.
export default function KeyFace({ label, role, ink, glyphInk, loading, big = false, bare = false }: Props) {
  const t = useTheme();
  return (
    <>
      {loading ? <LogoLoader size={9} /> : bare ? null : <KeyGlyph role={role} color={t[glyphInk ?? ink]} size={big ? 11 : 9} />}
      <PlainText
        fontFamily="mono"
        fontSize={big ? 13 : 12}
        lineHeight="20px"
        fontWeight="600"
        letterSpacing={big ? 1.6 : 1.2}
        textTransform="uppercase"
        userSelect="none"
        flexShrink={1}
        numberOfLines={1}
        color={ink}
      >
        {label}
      </PlainText>
    </>
  );
}
