import { Image as RNImage } from 'react-native';
import PlainText from '../../common/PlainText';
import { useSystemLogo } from './useSystemLogo';

type Props = {
  /** The names its logo may be filed under (logic/osLogo.ts). */
  keys: readonly string[];
  /** Drawn while no logo is on file. */
  letter: string;
  /** The logo's side, in dp. */
  size: number;
};

// What a system's plate holds: its OS's Docker Hub logo, else its letter as
// a plate's initial. The plate is the caller's. Used by the Systems list and
// New agent's Where does it run?.
export default function SystemLogo({ keys, letter, size }: Props) {
  const logo = useSystemLogo(keys);
  if (!logo) {
    return (
      <PlainText fontFamily="mono" fontSize={18} fontWeight="600" color="secondaryInk">
        {letter}
      </PlainText>
    );
  }
  return <RNImage source={{ uri: logo }} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />;
}
