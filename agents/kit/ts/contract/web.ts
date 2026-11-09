// A kind's web UI inside our WebView (the app hosts it: app/src/ui/chat/AgentWebView.tsx).

export type WebThemeMode = 'system' | 'light' | 'dark';

/** The app palette a web adapter maps onto the agent's own web UI. */
export type WebPalette = {
  bg: string;
  panel: string;
  panel2: string;
  fg: string;
  muted: string;
  dim: string;
  faint: string;
  line: string;
  lineStrong: string;
  primary: string;
  primaryHi: string;
};

/**
 * How our WebView fits a kind's web UI into the app: the manifest's
 * surfaces.web.adapter, passed on verbatim in the KindView. The app builds
 * the AgentWebUi below from it (app/src/engine/agents/webAdapter.ts).
 */
export type WebAdapterSpec = {
  /** localStorage key the web UI reads its color scheme from. */
  colorSchemeKey?: string;
  /** CSS variable → the palette role it takes, written in this order. */
  cssVars: Record<string, keyof WebPalette>;
  /** Selectors of the web UI's own chrome that duplicates our header. */
  hide?: string[];
  /** URLs containing this are the sign-in hand-off. */
  authUrl: string;
  /** A regex whose group 1 is the chat (session id) a URL shows. */
  sessionUrl?: string;
};

/** The agent's web UI inside our WebView. */
export type AgentWebUi = {
  /** Injected before and after every page load: follows the app's mode and palette. */
  themeScript(mode: WebThemeMode, palette: WebPalette): string;
  /** Hides the web UI's own chrome that duplicates our header. */
  embedScript: string;
  /** URLs of the sign-in hand-off, which never count as the web UI's home. */
  isAuthUrl(url: string): boolean;
  /** The chat (its session id) a web UI URL shows; null for any other page. */
  sessionOf(url: string): string | null;
};
