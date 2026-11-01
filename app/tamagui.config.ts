import { createFont, createTamagui } from 'tamagui';
import { config } from '@tamagui/config';
import tokens from '../theme/tokens.json';

type Tokens = typeof tokens.dark;

// Shared roles mapped onto a Tamagui theme, so component defaults (Input,
// Button, Popover, Sheet, Text) follow the same palette as our own styles.
function tamaguiTheme(t: Tokens) {
  return {
    background: t.panel2,
    backgroundHover: t.panel,
    backgroundPress: t.panel,
    backgroundFocus: t.panel2,
    backgroundStrong: t.panel,
    backgroundTransparent: 'transparent',
    color: t.fg,
    colorHover: t.fg,
    colorPress: t.muted,
    colorFocus: t.fg,
    colorTransparent: 'transparent',
    borderColor: t.line,
    borderColorHover: t.lineStrong,
    borderColorFocus: t.lineStrong,
    borderColorPress: t.lineStrong,
    placeholderColor: t.dim,
    // Tamagui components reach for shades: 1-3 are surfaces, 10 is the
    // secondary text step, 11-12 the highest contrast text.
    color1: t.bg,
    color2: t.panel,
    color3: t.panel2,
    color4: t.line,
    color5: t.lineStrong,
    color6: t.lineStrong,
    color7: t.dim,
    color8: t.dim,
    color9: t.muted,
    color10: t.muted,
    color11: t.fg,
    color12: t.fg,
    shadowColor: 'rgba(0,0,0,0.5)',
    shadowColorHover: 'rgba(0,0,0,0.4)',
    shadowColorPress: 'rgba(0,0,0,0.6)',
    shadowColorFocus: 'rgba(0,0,0,0.5)',
  };
}

// The default mono font is a CSS stack, and a system font overlay can map
// even `monospace` to the user's chosen sans. Bundle the site's Geist Mono
// so the brand/kickers/tabs look the same on every device.
const monoFont = createFont({
  family: 'GeistMono-Regular',
  face: {
    400: { normal: 'GeistMono-Regular' },
    500: { normal: 'GeistMono-Regular' },
    600: { normal: 'GeistMono-Bold' },
    700: { normal: 'GeistMono-Bold' },
  },
  size: { 1: 11, 2: 12, 3: 13, 4: 14, 5: 16, 6: 18, 7: 20 },
  lineHeight: { 1: 16, 2: 18, 3: 20, 4: 21, 5: 24, 6: 27, 7: 30 },
  weight: { 4: '400', 5: '500', 6: '600', 7: '700' },
  letterSpacing: { 4: 0 },
});

export const tamaguiConfig = createTamagui({
  ...config,
  // Button labels are always the mono role. The family itself lives here
  // once; components only opt into the role with `$mono` when it is text.
  defaultProps: {
    Button: { fontFamily: '$mono' },
  },
  fonts: { ...config.fonts, mono: monoFont },
  themes: {
    ...config.themes,
    dark: tamaguiTheme(tokens.dark),
    light: tamaguiTheme(tokens.light),
  },
});

export type Conf = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}

export default tamaguiConfig;
