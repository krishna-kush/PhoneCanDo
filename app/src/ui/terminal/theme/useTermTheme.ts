import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type { WebView } from 'react-native-webview';
import { useScheme } from '../../common/globals';
import { termLook, type TermLook, type XtermTheme } from './palette';
import { answer, themeReport, type TermQuery } from './replies';

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
};

// One terminal's theme: the app's scheme. The page starts in it (it rides
// on the page's URL, so there is no flash of the other one) and follows a
// change at once; the program gets its answers and, while it asked for
// them (DEC mode 2031), a theme report on every change.
export function useTermTheme({ webRef, htmlUri, reply }: Opts) {
  const scheme = useScheme();
  const look = termLook(scheme);
  const lookRef = useRef<TermLook>(look);
  lookRef.current = look;
  const replyRef = useRef(reply);
  replyRef.current = reply;
  const reports = useRef(false);
  const given = useRef(scheme);

  // Made once per page: a new URL would reload it.
  const uri = useMemo(
    () => (htmlUri == null ? null : `${htmlUri}#${encodeURIComponent(JSON.stringify(lookRef.current.xterm))}`),
    [htmlUri],
  );

  useEffect(() => {
    if (given.current === scheme) return;
    given.current = scheme;
    setPageTheme(webRef, termLook(scheme).xterm);
    if (reports.current) replyRef.current(themeReport(scheme === 'dark'));
  }, [scheme, webRef]);

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
        return true;
      }
      return false;
    },
  };
}

function setPageTheme(webRef: RefObject<WebView<object> | null>, xterm: XtermTheme) {
  webRef.current?.injectJavaScript(`window.__setTheme && window.__setTheme(${JSON.stringify(xterm)});true;`);
}
