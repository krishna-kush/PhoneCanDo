import { useEffect } from 'react';
import { engineTerminalTheme } from '../../../engine/engineTerminal';
import { useScheme } from '../../common/globals';
import { termLook } from './palette';

// The TUI engines' terminals answer in the app's scheme: the runner hears
// it at launch and on every change (engineTerminalTheme), for every engine
// at once, shown or not. Mounted once, at the root, before any engine
// starts: an engine takes it as COLORFGBG at its start and keeps that until
// it restarts.
export function useEngineTerminalTheme() {
  const scheme = useScheme();
  useEffect(() => {
    engineTerminalTheme(termLook(scheme).colors);
  }, [scheme]);
}
