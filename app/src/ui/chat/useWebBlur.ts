import { useEffect, type RefObject } from 'react';
import type { WebView } from 'react-native-webview';
import { useAppStore } from '../../state/app';
import { useHomeInFront } from '../nav/homeInFront';

// Drops the web page's text focus once Home is covered: a page slides over
// it or the drawer opens. A field that keeps it keeps the keyboard and its
// input too (Keyboard.dismiss only reaches our own text inputs), so the
// keyboard stayed up over the drawer and what you typed on a page landed in
// the chat box behind it. Blurring the field hides the keyboard with it.
// Nothing gives the focus back: a tap on the field does.
const BLUR = `(function () {
  var el = document.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
  if (el && el !== document.body && typeof el.blur === 'function') el.blur();
})();
true;`;

export function useWebBlur(web: RefObject<WebView<object> | null>) {
  const inFront = useHomeInFront();
  useEffect(() => {
    if (!inFront) web.current?.injectJavaScript(BLUR);
  }, [inFront, web]);

  // A subscription, not a hook: the web view must not render again for each
  // open and close of the drawer.
  useEffect(
    () =>
      useAppStore.subscribe((s, prev) => {
        if (s.drawerOpen && !prev.drawerOpen) web.current?.injectJavaScript(BLUR);
      }),
    [web],
  );
}
