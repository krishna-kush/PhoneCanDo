// The theme's colours for the canvas, read from the vars layouts/Base.astro
// sets from theme/tokens.json, so the backdrop follows the nav's toggle.

export type Palette = {
  light: boolean;
  bg: string;
  panel: string;
  panel2: string;
  line: string;
  line2: string;
  fg: string;
  muted: string;
  faint: string;
  red: string;
  accent: string;
  /** Line-work: amber on night ink, its dark ink on white, where the light amber is too pale for lines. */
  ink: string;
  onPrimary: string;
  /** Screens stay dark in both themes, as the page's own do. */
  artBg: string;
  artFg: string;
  artDim: string;
};

export function readPalette(): Palette {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const v = (name: string) => css.getPropertyValue(`--${name}`).trim();
  const light = root.dataset.theme === 'light';
  return {
    light,
    bg: v('bg'),
    panel: v('panel'),
    panel2: v('panel-2'),
    line: v('line'),
    line2: v('line-2'),
    fg: v('fg'),
    muted: v('muted'),
    faint: v('faint'),
    red: v('red'),
    accent: v('accent'),
    ink: light ? v('accent-ink') : v('accent'),
    onPrimary: v('on-primary'),
    artBg: v('art-bg'),
    artFg: v('art-fg'),
    artDim: v('art-dim'),
  };
}
