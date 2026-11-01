import { useColorScheme } from 'react-native';
import { useAppStore } from '../../../state/app';
import tokens from '../../../../../theme/tokens.json';

// Single source: <repo>/theme/tokens.json. The same file is read by
// web/src/layouts/Base.astro, so the site and the app cannot drift. Roles
// (bg/panel/fg/primary/secondary) are mapped onto each side's own vocabulary.
export type Theme = typeof tokens.dark;
export type Scheme = 'dark' | 'light';

export function useScheme(): Scheme {
  const system = useColorScheme();
  const mode = useAppStore((s) => s.themeMode);
  if (mode !== 'system') return mode;
  return system === 'light' ? 'light' : 'dark';
}

export function useTheme(): Theme {
  return tokens[useScheme()];
}

// The terminal is the TUI's own canvas (opencode/xterm pick its colours), so
// its chrome stays dark in both schemes — the app never paints over it with
// theme colours. `primary` still comes from the shared palette.
export const TUI = {
  bg: '#0a0a0a',
  panel: '#111111',
  line: '#222222',
  fg: '#888888',
  primary: tokens.dark.primary,
} as const;
