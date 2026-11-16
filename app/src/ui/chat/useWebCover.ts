import { useCallback, useEffect, type RefObject } from 'react';
import type { WebView } from 'react-native-webview';
import { useAppStore } from '../../state/app';
import { homeInFrontNow, useHomeInFront } from '../nav/homeInFront';
import { COVER_SCRIPT, UNCOVER_SCRIPT } from './webCover';

// Tells the web page whether Home is covered: a page is on the stack or
// still slides off, or the drawer is open. The stack counts at once, so
// opening a page from the drawer (which shuts it in the same set) never
// uncovers Home between the two. Covered, its field lets go of the
// keyboard (Keyboard.dismiss only reaches our own text inputs, so the
// keyboard stayed up over the drawer) and keys typed reach nothing in it,
// though the web view keeps Android's input focus (webCover.ts). In front
// again, keys reach it; a tap gives a field its focus back. Returns the
// call that says it again, for a document that loaded meanwhile
// (AgentWebView's onLoadEnd).
export function useWebCover(web: RefObject<WebView<object> | null>): () => void {
  const inFront = useHomeInFront();
  const apply = useCallback(() => {
    const { drawerOpen, pages } = useAppStore.getState();
    const covered = !homeInFrontNow() || drawerOpen || pages.length > 0;
    web.current?.injectJavaScript(covered ? COVER_SCRIPT : UNCOVER_SCRIPT);
  }, [web]);

  useEffect(() => {
    apply();
  }, [inFront, apply]);

  // A subscription, not a hook: the web view must not render again for each
  // open and close of the drawer, or each page.
  useEffect(
    () =>
      useAppStore.subscribe((s, prev) => {
        if (s.drawerOpen !== prev.drawerOpen || (s.pages.length > 0) !== (prev.pages.length > 0)) apply();
      }),
    [apply],
  );

  return apply;
}
