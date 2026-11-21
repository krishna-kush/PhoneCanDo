import { Image } from 'react-native';
import { YStack } from 'tamagui';
import { useAppIcon } from './useAppIcon';

type Props = {
  /** The app's package. */
  pkg: string;
  /** Its side in dp. */
  size: number;
  /** Faded: the app is blocked. */
  dim?: boolean;
};

// An app's own launcher icon (useAppIcon), as the phone's launcher shows
// it, beside its name on the Apps page and the app question's slip. With
// none to show (still on its way, Android hides the app, a build that
// draws none) an empty slot holds its place: a dashed hairline frame with
// a small hollow square in it, never a letter. Its name says what it is,
// so a screen reader skips it.
export default function AppIcon({ pkg, size, dim = false }: Props) {
  const uri = useAppIcon(pkg, size);
  const fade = dim ? 0.45 : 1;
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, opacity: fade }}
        fadeDuration={120}
        accessible={false}
        importantForAccessibility="no"
      />
    );
  }
  const mark = Math.max(6, Math.round(size * 0.3));
  return (
    <YStack
      width={size}
      height={size}
      borderWidth={1}
      borderStyle="dashed"
      borderColor="lineStrong"
      alignItems="center"
      justifyContent="center"
      opacity={fade}
      accessible={false}
      importantForAccessibility="no"
    >
      <YStack width={mark} height={mark} borderWidth={1} borderColor="faint" />
    </YStack>
  );
}
