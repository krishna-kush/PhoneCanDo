import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { countShareInstall } from '../../state/flows/share';
import { useAppStore } from '../../state/app';

// The friend's side of a share link: Android opens the app with
// phonecando.app/i/<code> (as it was launched, or while it runs) once the
// app is installed; flows/share.ts decides whether that counts as an
// install from the link. Held until usage stats are up, so a link that
// launched the app is not lost to their start.
export function useShareLinkOpen(): void {
  const ready = useAppStore((s) => s.telemetry.ready);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Linking.getInitialURL()
      .then((url) => {
        if (live && url) setPending(url);
      })
      .catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => setPending(url));
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!ready || pending == null) return;
    setPending(null);
    void countShareInstall(pending);
  }, [ready, pending]);
}
