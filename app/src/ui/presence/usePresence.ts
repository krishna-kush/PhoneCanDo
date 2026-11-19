import { useEffect, useRef } from 'react';
import { lookKey } from '../../../../mascot/look.ts';
import { mascotFiguresJson } from '../../engine/presence/figures';
import { setGlassScheme, setMascotFigures } from '../../engine/presence/native';
import { useMascotsStore } from '../../state/mascots';
import { usePresenceStore } from '../../state/presence';
import { BODY } from '../common/face/body';
import { useAppStore } from '../../state/app';

// Presence from launch: reads who has the phone's controls and the agents'
// status lines (state/presence.ts), and hands the overlay every agent's
// mascot in the poses it draws on the screen (engine/presence/figures.ts).
// Native keeps the figures in memory only, so they all go again at each
// start; after that, only an agent whose look changed, or a new agent
// (its look picked by useMascotPicks), sends its own again. It also tells
// the overlay the app's own theme setting (System, Light or Dark), which
// may differ from the phone's. Mounted once, in App.tsx.
export function usePresence() {
  const looks = useMascotsStore((s) => s.looks);
  const themeMode = useAppStore((s) => s.themeMode);
  // Each agent's look as last handed over.
  const sent = useRef(new Map<string, string>());

  useEffect(() => {
    usePresenceStore.getState().hydratePresence();
  }, []);

  // The glass follows the app's own theme setting: Light or Dark, or the phone's with System.
  useEffect(() => {
    setGlassScheme(themeMode);
  }, [themeMode]);

  useEffect(() => {
    for (const [agentId, look] of Object.entries(looks)) {
      const key = lookKey(look);
      if (sent.current.get(agentId) === key) continue;
      sent.current.set(agentId, key);
      setMascotFigures(agentId, mascotFiguresJson(look, BODY));
    }
  }, [looks]);
}
