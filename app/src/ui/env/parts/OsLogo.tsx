import { Image as RNImage } from 'react-native';
import PlainText from '../../common/PlainText';

type Props = {
  /** Its Docker Hub logo; null while none is on file. */
  uri: string | null;
  /** The logo's side, in dp. */
  size: number;
  /** Drawn without a logo: the root's slash, as the site's passport photo prints it. */
  fallback?: string;
};

// An OS's mark at a row's start, never a letter in a box: its logo, else
// a mark in amber mono the logo's size, so rows keep one edge.
export default function OsLogo({ uri, size, fallback = '/' }: Props) {
  if (uri) {
    return <RNImage source={{ uri }} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />;
  }
  return (
    <PlainText fontFamily="mono" fontSize={Math.round(size * 0.9)} lineHeight={`${size}px`} color="secondaryInk" textAlign="center" width={size}>
      {fallback}
    </PlainText>
  );
}
