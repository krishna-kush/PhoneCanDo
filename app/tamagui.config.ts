import { createFont, createTamagui } from 'tamagui';
import { defaultConfig } from '@tamagui/config/v5';
import { animations } from '@tamagui/config/animations-rn';
import tokens from '../theme/tokens.json';

type Tokens = typeof tokens.dark;

// Shared roles mapped onto a Tamagui theme, so component defaults (Input,
// Button, Popover, Sheet, Text) follow the same palette as our own styles.
// v3 components read the kebab-case names; the 12-step ramp keeps the v5
// pack's spelling (`color10`).
function tamaguiTheme(t: Tokens) {
  return {
    background: t.panel2,
    'background-hover': t.panel,
    'background-press': t.panel,
    'background-focus': t.panel2,
    'background-strong': t.panel,
    'background-transparent': 'transparent',
    color: t.fg,
    'color-hover': t.fg,
    'color-press': t.muted,
    'color-focus': t.fg,
    'color-transparent': 'transparent',
    'border-color': t.line,
    'border-color-hover': t.lineStrong,
    'border-color-focus': t.lineStrong,
    'border-color-press': t.lineStrong,
    'placeholder-color': t.dim,
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
    'shadow-color': 'rgba(0,0,0,0.5)',
    'shadow-color-hover': 'rgba(0,0,0,0.4)',
    'shadow-color-press': 'rgba(0,0,0,0.6)',
    'shadow-color-focus': 'rgba(0,0,0,0.5)',
  };
}

// Tamagui 2 gave Button, Input and the sheet's overlay their own component
// themes (dark_Button, ...) from its default config. Tamagui 3 dropped those,
// so their colours are frozen here, keys missing from them still come from
// dark/light. Button now renders inside `level2`, Input inside `Input`.
const v2Button = {
  dark: {
    background: '#232323',
    'background-hover': '#282828',
    'background-press': '#323232',
    'background-focus': '#424242',
    'background-strong': '#191919',
    'background-transparent': '#151515',
    color: '#fff',
    'color-hover': '#a5a5a5',
    'color-press': '#fff',
    'color-focus': '#a5a5a5',
    'color-transparent': '#a5a5a5',
    'border-color': 'transparent',
    'border-color-hover': 'transparent',
    'border-color-focus': '#323232',
    'border-color-press': '#424242',
    'placeholder-color': '#424242',
  },
  light: {
    background: 'hsl(0, 0%, 94.1%)',
    'background-hover': 'hsl(0, 0%, 92.0%)',
    'background-press': 'hsl(0, 0%, 90.0%)',
    'background-focus': 'hsl(0, 0%, 88.5%)',
    'background-strong': 'hsl(0, 0%, 96.3%)',
    'background-transparent': '#f8f8f8',
    color: 'hsl(0, 0%, 9.0%)',
    'color-hover': 'hsl(0, 0%, 42.5%)',
    'color-press': 'hsl(0, 0%, 9.0%)',
    'color-focus': 'hsl(0, 0%, 42.5%)',
    'color-transparent': 'hsl(0, 0%, 42.5%)',
    'border-color': 'transparent',
    'border-color-hover': 'transparent',
    'border-color-focus': 'hsl(0, 0%, 90.0%)',
    'border-color-press': 'hsl(0, 0%, 88.5%)',
    'placeholder-color': 'hsl(0, 0%, 88.5%)',
  },
};

const v2Input = {
  dark: {
    background: '#151515',
    'background-hover': '#191919',
    'background-press': '#232323',
    'background-focus': '#282828',
    'background-strong': '#050505',
    'background-transparent': 'rgba(10,10,10,0)',
    color: '#fff',
    'color-hover': '#a5a5a5',
    'color-press': '#fff',
    'color-focus': '#a5a5a5',
    'color-transparent': 'rgba(255,255,255,0)',
    'border-color': '#424242',
    'border-color-hover': '#494949',
    'border-color-focus': '#323232',
    'border-color-press': '#424242',
    'placeholder-color': '#545454',
  },
  light: {
    background: '#f8f8f8',
    'background-hover': 'hsl(0, 0%, 96.3%)',
    'background-press': 'hsl(0, 0%, 94.1%)',
    'background-focus': 'hsl(0, 0%, 92.0%)',
    'background-strong': '#fff',
    'background-transparent': 'rgba(255,255,255,0)',
    color: 'hsl(0, 0%, 9.0%)',
    'color-hover': 'hsl(0, 0%, 42.5%)',
    'color-press': 'hsl(0, 0%, 9.0%)',
    'color-focus': 'hsl(0, 0%, 42.5%)',
    'color-transparent': 'rgba(10,10,10,0)',
    'border-color': 'hsl(0, 0%, 88.5%)',
    'border-color-hover': 'hsl(0, 0%, 81.0%)',
    'border-color-focus': 'hsl(0, 0%, 90.0%)',
    'border-color-press': 'hsl(0, 0%, 88.5%)',
    'placeholder-color': 'hsl(0, 0%, 56.1%)',
  },
};

// The sheet's dimmed backdrop (v2's SheetOverlay theme), read by name.
const sheetOverlay = { dark: 'rgba(0,0,0,0.9)', light: 'rgba(0,0,0,0.5)' };

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

// The v5 pack keeps v2's spacing, size and radius values. Its settings are
// stricter than v2 was; we keep v2's: longhand props and any colour string.
export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  animations,
  settings: { ...defaultConfig.settings, onlyAllowShorthands: false, allowedStyleValues: false },
  fonts: { ...defaultConfig.fonts, mono: monoFont },
  themes: {
    dark: { ...tamaguiTheme(tokens.dark), 'sheet-overlay': sheetOverlay.dark },
    light: { ...tamaguiTheme(tokens.light), 'sheet-overlay': sheetOverlay.light },
    dark_level2: v2Button.dark,
    light_level2: v2Button.light,
    dark_Input: v2Input.dark,
    light_Input: v2Input.light,
  },
});

export type Conf = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}

export default tamaguiConfig;
