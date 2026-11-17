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
  secondary: string;
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
  /** The path that shows one chat: {{sessionId}}, and {{origin64}} for the page's origin as base64url. */
  sessionPath?: string;
  /**
   * Where the app's guide can point in the web UI, on the way to a chat
   * (the first shift's Say hi): per place, a selector whose first match in
   * front is the thing to tap. A place the web UI lacks is left out.
   */
  spots?: Partial<Record<WebSpot, string>>;
};

/**
 * The places on the way to a chat in a web UI, in order: the project
 * list, its Add project, the folder picker's pick, a new chat, the chat
 * box.
 */
export type WebSpot = 'projects' | 'addProject' | 'pickFolder' | 'newChat' | 'composer';

/** Where a web UI's spots are, in its own CSS pixels, with its viewport width to scale them by. */
export type WebSpotRects = {
  width: number;
  spots: Partial<Record<WebSpot, { x: number; y: number; width: number; height: number }>>;
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
  /** The spots this web UI has. */
  spots: readonly WebSpot[];
  /**
   * Asks the page to report where [places] are (as messages readSpots
   * reads) while any are given; none stops it. Needs SPOTS_WATCH
   * installed at document start.
   */
  watchScript(places: readonly WebSpot[]): string;
};
