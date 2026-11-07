import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImageId } from '../../engine/linux/types';
import { getBuildChannel } from '../../engine/runner';
import { continueWithoutLinux, setUpFirstAgent } from '../../state/flows/firstLaunch';
import { linuxErrorCode } from '../../state/flows/logic/errors';
import { useLinuxStore } from '../../state/linux';
import { linuxFailureText } from '../env/logic/errorText';
import type { SetupContext } from './copy';

export type SetupPhase = { kind: 'working' } | { kind: 'failed'; reason: string };

// Runs first launch once: Linux when this build has it, else straight to the
// Android path. A build that has Linux but not the Default image (a dev
// build before staging it) answers linux_unavailable, which takes the
// Android path the same way. Retry runs the same path again (setup reuses
// the image it already made); Continue without Linux drops that image and
// takes the Android path. Success needs nothing here: App swaps this screen
// out as soon as the first agent exists.
export function useFirstLaunch() {
  const [ctx, setCtx] = useState<SetupContext>({ path: 'linux', play: false, noLinux: null });
  const [imageId, setImageId] = useState<ImageId | null>(null);
  const [phase, setPhase] = useState<SetupPhase>({ kind: 'working' });
  const started = useRef(false);

  const runAndroid = useCallback((noLinux: SetupContext['noLinux'], failedImageId: ImageId | null) => {
    setImageId(null);
    setPhase({ kind: 'working' });
    setCtx((c) => ({ ...c, path: 'android', noLinux }));
    continueWithoutLinux(failedImageId, { onImage: setImageId }).catch((e: unknown) =>
      setPhase({ kind: 'failed', reason: linuxFailureText(e) }),
    );
  }, []);

  const runLinux = useCallback(() => {
    let made: ImageId | null = null;
    setPhase({ kind: 'working' });
    setCtx((c) => ({ ...c, path: 'linux', noLinux: null }));
    setUpFirstAgent('linux', {
      onImage: (id) => {
        made = id;
        setImageId(id);
      },
    }).catch((e: unknown) => {
      if (linuxErrorCode(e) === 'linux_unavailable') runAndroid('unavailable', made);
      else setPhase({ kind: 'failed', reason: linuxFailureText(e) });
    });
  }, [runAndroid]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    useLinuxStore.getState().hydrateLinux();
    const play = getBuildChannel() === 'play';
    const available = useLinuxStore.getState().status.available;
    setCtx({ path: available ? 'linux' : 'android', play, noLinux: available ? null : 'unavailable' });
    if (available) runLinux();
    else runAndroid('unavailable', null);
  }, [runAndroid, runLinux]);

  const retry = () => {
    if (ctx.path === 'linux') runLinux();
    else runAndroid(ctx.noLinux, null);
  };

  const skipLinux = () => runAndroid('skipped', imageId);

  return { ctx, imageId, phase, retry, skipLinux };
}
