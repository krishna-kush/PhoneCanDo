import { useEffect, useRef, useState } from 'react';
import type { Look } from '../../../../mascot/look.ts';
import { pickLook } from '../../../../mascot/pick.ts';
import { setupPick } from '../../engine/agents/offers';
import type { ImageId } from '../../engine/linux/types';
import { getBuildChannel } from '../../engine/runner';
import { continueWithoutLinux, setUpFirstAgent, type SetupPath } from '../../state/flows/firstLaunch';
import { defaultKindId, offersForEnv } from '../../state/flows/kindOffers';
import { linuxErrorCode } from '../../state/flows/logic/errors';
import type { AgentPick } from '../../state/flows/logic/modelStep';
import { useLinuxStore } from '../../state/linux';
import { noOfferText, setupOfferEnv } from '../env/logic/agentChoice';
import { linuxFailureText } from '../env/logic/errorText';
import type { SetupContext } from './copy';

export type SetupPhase = { kind: 'working' } | { kind: 'failed'; reason: string };

// Runs first launch once: Linux when this build has it, else straight to the
// Android path. A build that has Linux but not the Default image (a dev
// build before staging it) answers linux_unavailable, which takes the
// Android path the same way. It never asks which agent: it sets up the
// default kind (offers.ts setupPick) on the agent's own setup, wearing a
// mascot picked here so the face the setup screen shows is the one it
// keeps; more agents come from the menu later. Retry runs the same path
// again (setup reuses the image it already made); Continue without Linux
// drops that image and takes the Android path. Success needs nothing here:
// App swaps this screen out as soon as the first agent exists. Everything the steps share is in refs or state setters, so a
// step started in one render finishes right in a later one.
export function useFirstLaunch() {
  const [ctx, setCtx] = useState<SetupContext>({ path: 'linux', play: false, noLinux: null });
  const [imageId, setImageId] = useState<ImageId | null>(null);
  const [phase, setPhase] = useState<SetupPhase>({ kind: 'working' });
  // No agent exists yet, so any look is nobody's.
  const [look] = useState<Look>(() => pickLook([], Math.random));
  const [kindId, setKindId] = useState<string | null>(null);
  const started = useRef(false);
  /** The kind being set up, once taken. */
  const pick = useRef<AgentPick | null>(null);
  /** The Linux image to drop when the Android path runs (it failed, or Linux was skipped). */
  const dropImage = useRef<ImageId | null>(null);

  function run(path: SetupPath, chosen: AgentPick) {
    setPhase({ kind: 'working' });
    if (path === 'android') {
      setImageId(null);
      const drop = dropImage.current;
      dropImage.current = null;
      continueWithoutLinux(drop, chosen, { onImage: setImageId }).catch((e: unknown) =>
        setPhase({ kind: 'failed', reason: linuxFailureText(e) }),
      );
      return;
    }
    let made: ImageId | null = null;
    setUpFirstAgent('linux', chosen, {
      onImage: (id) => {
        made = id;
        setImageId(id);
      },
    }).catch((e: unknown) => {
      if (linuxErrorCode(e) === 'linux_unavailable') toAndroid('unavailable', made);
      else setPhase({ kind: 'failed', reason: linuxFailureText(e) });
    });
  }

  // Goes on with the kind already taken when it can run on this path, else
  // the default kind (or the first that can); says so when none can.
  function proceed(path: SetupPath) {
    const offers = offersForEnv(setupOfferEnv(path, useLinuxStore.getState().envs));
    const kindId = setupPick(offers, pick.current?.kindId ?? null, defaultKindId());
    if (!kindId) {
      setPhase({ kind: 'failed', reason: noOfferText(offers) ?? 'No agent can run here.' });
      return;
    }
    const chosen = pick.current?.kindId === kindId ? pick.current : { kindId, modelId: null, look };
    pick.current = chosen;
    setKindId(kindId);
    run(path, chosen);
  }

  function toAndroid(noLinux: SetupContext['noLinux'], failedImageId: ImageId | null) {
    dropImage.current = failedImageId;
    setImageId(null);
    setCtx((c) => ({ ...c, path: 'android', noLinux }));
    proceed('android');
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    useLinuxStore.getState().hydrateLinux();
    const play = getBuildChannel() === 'play';
    const available = useLinuxStore.getState().status.available;
    setCtx({ path: available ? 'linux' : 'android', play, noLinux: available ? null : 'unavailable' });
    proceed(available ? 'linux' : 'android');
    // Once, on mount (started guards a second run); the steps read refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = () => {
    if (pick.current) run(ctx.path, pick.current);
    else proceed(ctx.path);
  };

  const skipLinux = () => toAndroid('skipped', imageId);

  return { ctx, imageId, phase, look, kindId, retry, skipLinux };
}
