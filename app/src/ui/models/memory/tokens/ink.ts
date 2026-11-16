import type { Theme } from '../../../common/globals';

/** A token's state: in the count, in it but with no room now, or out of it. */
export type TokenState = 'in' | 'short' | 'out';

/** Its outline: ink in the count, red with no room now, faint out of it. */
export const outlineOf = (s: TokenState): keyof Theme => (s === 'in' ? 'fg' : s === 'short' ? 'primary' : 'lineStrong');

/** What fills it: amber in the count (red with no room), the hairline out of it. */
export const fillOf = (s: TokenState): keyof Theme => (s === 'in' ? 'secondary' : s === 'short' ? 'primary' : 'line');
