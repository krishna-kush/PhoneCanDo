import type { ReactNode } from 'react';
import { Text, type TextStyle } from 'react-native';
import { monoFace } from '../../../tamagui.config';
import { useTheme, type Theme } from './globals';

type Weight = keyof typeof monoFace;

type Props = {
  children: ReactNode;
  /** A role of the palette (theme/tokens.json); the default is the body ink. */
  color?: keyof Theme;
  fontSize: number;
  fontWeight?: `${Weight}`;
  fontFamily?: 'mono';
  /** In px, as `"19px"`: a bare number would be a multiple of the font size in Tamagui. */
  lineHeight?: `${number}px`;
  letterSpacing?: number;
  textTransform?: 'uppercase';
  textAlign?: 'center' | 'right';
  textDecorationLine?: 'underline';
  numberOfLines?: number;
  ellipsizeMode?: 'tail';
  userSelect?: 'text' | 'none';
  flex?: number;
  flexGrow?: number;
  flexShrink?: number;
  minWidth?: number;
  width?: number;
};

// A line of text drawn as React Native's own Text, for the text repeated on
// every page that Tamagui's compiler cannot flatten (a size of its own over
// words only known at run time sends Tamagui's Text through its whole style
// engine on each render). Takes Tamagui's prop names and gives the view
// Tamagui's Text gave them: mono picks Geist Mono's file for the weight, a
// colour is a palette role, `userSelect` is `selectable`. Not for text
// inside a Tamagui component theme (a Button's label): its ink is the app's.
export default function PlainText({
  children,
  color = 'fg',
  fontFamily,
  fontWeight,
  lineHeight,
  numberOfLines,
  ellipsizeMode,
  userSelect,
  ...layout
}: Props) {
  const t = useTheme();
  const style: TextStyle = {
    ...layout,
    color: t[color],
    ...(fontFamily === 'mono'
      ? { fontFamily: monoFace[Number(fontWeight ?? 400) as Weight].normal }
      : fontWeight
        ? { fontWeight: Number(fontWeight) as TextStyle['fontWeight'] }
        : null),
    ...(lineHeight ? { lineHeight: parseFloat(lineHeight) } : null),
  };
  return (
    <Text
      suppressHighlighting
      selectable={userSelect ? userSelect === 'text' : undefined}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
      style={style}
    >
      {children}
    </Text>
  );
}
