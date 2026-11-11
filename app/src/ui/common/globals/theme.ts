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
