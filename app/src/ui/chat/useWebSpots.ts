import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import type { WebView } from 'react-native-webview';
import type { AgentWebUi, WebSpot } from '../../../../agents/kit/ts/contract/web.ts';
import { readSpots } from '../../engine/agents/webAdapter';
import { addSpot, type SpotMark, type SpotNode } from '../common/spot/registry';
import { useWantedSpots } from '../common/spot/wanted';

export type WebSpots = {
  /** Asks the page again (a new document forgets). */
  watch: () => void;
  /** A message from the page. */
  onMessage: (data: string) => void;
};

// The web UI's spots, for a guide on the way to a chat (the first shift's
// Say hi: opencode's projects, Add project, ...). While the guide wants any
// of the ones this web UI has (common/spot/wanted.ts), the page says where
// they are (webAdapter's SPOTS_WATCH), and each one in front is marked as a
// spot on the web view [frame], at its place inside it.
export function useWebSpots(
  web: RefObject<WebView<object> | null>,
  frame: RefObject<SpotNode | null>,
  webUi: AgentWebUi | null,
): WebSpots {
  const wanted = useWantedSpots();
  const places = useMemo(
    () => (webUi ? webUi.spots.filter((p) => wanted.includes(`web.${p}`)) : []),
    [webUi, wanted],
  );
  const marks = useRef(new Map<WebSpot, { mark: SpotMark; drop: () => void }>());

  const clear = useCallback(() => {
    for (const m of marks.current.values()) m.drop();
    marks.current.clear();
  }, []);

  const watch = useCallback(() => {
    if (webUi) web.current?.injectJavaScript(webUi.watchScript(places));
  }, [web, webUi, places]);

  useEffect(() => {
    watch();
    if (places.length === 0) clear();
  }, [watch, places, clear]);
  useEffect(() => clear, [clear]);

  const onMessage = useCallback(
    (data: string) => {
      const read = readSpots(data);
      const node = frame.current;
      if (!read || !node) return;
      for (const place of webUi?.spots ?? []) {
        const at = places.includes(place) ? read.spots[place] : undefined;
        const held = marks.current.get(place);
        if (at && held) {
          held.mark.inner = { ...at, across: read.width };
        } else if (at) {
          const mark: SpotMark = { node, inner: { ...at, across: read.width } };
          marks.current.set(place, { mark, drop: addSpot(`web.${place}`, mark) });
        } else if (held) {
          held.drop();
          marks.current.delete(place);
        }
      }
    },
    [frame, webUi, places],
  );

  return { watch, onMessage };
}
