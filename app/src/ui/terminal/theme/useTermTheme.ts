import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { WebView } from 'react-native-webview';
import { useScheme } from '../../common/globals';
import { termLook, type TermLook, type XtermTheme } from './palette';
import { answer, themeChange, type TermQuery } from './replies';

/** What the page says about the program's queries (terminal.js). */
export type ThemePageMsg =
  /** A query to answer (replies.ts). */
  | { type: 'query'; query: TermQuery }
  /** The program turned theme reports (DEC mode 2031) on or off, or reset the terminal. */
  | { type: 'themeReports'; on: boolean };

type Opts = {
  webRef: RefObject<WebView<object> | null>;
  /** The page, once its asset is local. */
  htmlUri: string | null;
  /** Writes an answer to the program; drops it when the PTY's host answers itself (an engine's). */
  reply: (text: string) => void;
  /** Its page is the one in front: the PTY is read only then. */
  active: boolean;
  /** Reads the PTY fast for a moment, so the program's next questions get quick answers. */
  hurry: () => void;
};

// One terminal's theme: the app's scheme. The page starts in it (it rides
// on the page's URL, so there is no flash of the other one) and follows a
// change at once; the program gets its answers and, while it asked for
// them (DEC mode 2031), a theme report on every change, with the new
// colours in the same write (replies.ts themeChange: a TUI asks for them
// and drops late answers). The report waits until the page is in front,
// where the PTY is read: the program's own questions and its redraw come
// back quickly then, and faster still for a moment (hurry).
export function useTermTheme({ webRef, htmlUri, reply, active, hurry }: Opts) {
  const scheme = useScheme();
  const look = termLook(scheme);
  const lookRef = useRef<TermLook>(look);
  lookRef.current = look;
  const replyRef = useRef(reply);
  replyRef.current = reply;
  const hurryRef = useRef(hurry);
  hurryRef.current = hurry;
  const reports = useRef(false);
  const given = useRef(scheme);
  const schemeRef = useRef(scheme);
  schemeRef.current = scheme;
  // The scheme the program last learned (at its start, or from a report).
  const told = useRef(scheme);

  // Made once per page: a new URL would reload it.
  const uri = useMemo(
    () => (htmlUri == null ? null : `${htmlUri}#${encodeURIComponent(JSON.stringify(lookRef.current.xterm))}`),
    [htmlUri],
  );

  useEffect(() => {
    if (given.current === scheme) return;
    given.current = scheme;
    setPageTheme(webRef, termLook(scheme).xterm);
  }, [scheme, webRef]);

  useEffect(() => {
    if (!active || !reports.current || told.current === scheme) return;
    told.current = scheme;
    replyRef.current(themeChange(lookRef.current.colors));
    hurryRef.current();
  }, [scheme, active]);

  return {
    look,
    uri,
    /** The page is up: it gets the theme again, in case it changed while the page loaded. */
    onReady() {
      setPageTheme(webRef, lookRef.current.xterm);
    },
    /** Handles a theme message from the page; false for any other. */
    onMessage(msg: { type: string }): boolean {
      const m = msg as ThemePageMsg;
      if (m.type === 'query') {
        const text = answer(m.query, lookRef.current.colors);
        if (text) replyRef.current(text);
        return true;
      }
      if (m.type === 'themeReports') {
        reports.current = m.on;
        // A program turning them on asks its theme itself (it starts knowing it).
        if (m.on) told.current = schemeRef.current;
        return true;
      }
      return false;
    },
  };
}

function setPageTheme(webRef: RefObject<WebView<object> | null>, xterm: XtermTheme) {
  webRef.current?.injectJavaScript(`window.__setTheme && window.__setTheme(${JSON.stringify(xterm)});true;`);
}
